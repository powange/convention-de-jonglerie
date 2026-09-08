import { describe, it, expect, vi, beforeEach } from 'vitest'

import { logApiError } from '../../../../server/utils/error-logger'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const makeEvent = (userId?: number, body?: Record<string, unknown>) => ({
  node: {
    req: {
      url: '/api/test',
      // Le corps n'est relevé que hors GET : une requête qui en porte un est donc un POST.
      method: body ? 'POST' : 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    },
  },
  context: { user: userId ? { id: userId } : undefined, _body: body },
})

/** Le corps tel qu'il est finalement écrit dans le journal. */
const corpsEnregistre = () => prismaMock.apiErrorLog.create.mock.calls[0][0].data.body

describe('error-logger – logApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enregistre le log avec le userId de la session', async () => {
    prismaMock.apiErrorLog.create.mockResolvedValue({})

    await logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(7) as any })

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.userId).toBe(7)
  })

  // Garde-fou : le userId vient d'un cookie de session et peut référencer un utilisateur supprimé
  // (ex. session restée valide après un reset de la base). Le log ne doit pas être perdu : on
  // réessaie sans le lien utilisateur sur violation de clé étrangère (P2003).
  it('réessaie sans userId quand la clé étrangère userId est violée (P2003)', async () => {
    prismaMock.apiErrorLog.create
      .mockRejectedValueOnce(Object.assign(new Error('FK'), { code: 'P2003' }))
      .mockResolvedValueOnce({})

    await logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(999) as any })

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.userId).toBe(999)
    expect(prismaMock.apiErrorLog.create.mock.calls[1][0].data.userId).toBeNull()
  })

  it('ne réessaie pas pour une autre erreur de base de données', async () => {
    prismaMock.apiErrorLog.create.mockRejectedValue(
      Object.assign(new Error('autre'), { code: 'P2002' })
    )

    // L'erreur est avalée par le try/catch externe de logApiError (le logging ne doit jamais
    // faire planter l'application) : l'appel ne rejette pas.
    await expect(
      logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(7) as any })
    ).resolves.toBeUndefined()

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
  })

  // Une erreur de validation porte le détail des champs refusés dans `data.errors`, mais seul le
  // message était journalisé : « Données invalides » revenait passage après passage sans qu'on
  // sache quel champ était en cause.
  /**
   * Ce que le corps de la requête garde, et ce qu'il perd.
   *
   * Le téléphone était masqué comme un mot de passe. Un refus de validation portant précisément
   * sur lui devenait alors indiagnosticable : le journal disait « Numéro de téléphone invalide »
   * sans jamais dire lequel. Il reste lisible ; les secrets, eux, ne le sont jamais.
   */
  describe('champs du corps conservés ou masqués', () => {
    beforeEach(() => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})
    })

    it('garde le numéro de téléphone lisible', async () => {
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { phone: '0612345678', nom: 'Dupont' }) as any,
      })

      expect(corpsEnregistre()).toMatchObject({ phone: '0612345678', nom: 'Dupont' })
    })

    it('masque toujours les secrets, quelle que soit la casse du champ', async () => {
      // `currentPassword` et `apiKey` ne l'étaient pas : la liste des champs sensibles était
      // écrite en casse mixte et confrontée à une clé mise en minuscules, si bien qu'un mot de
      // passe courant partait en clair dans le journal.

      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, {
          password: 'hunter2',
          currentPassword: 'hunter1',
          token: 'abc',
          apiKey: 'xyz',
        }) as any,
      })

      expect(corpsEnregistre()).toEqual({
        password: '***REDACTED***',
        currentPassword: '***REDACTED***',
        token: '***REDACTED***',
        apiKey: '***REDACTED***',
      })
    })

    it("ne garde que le domaine d'une adresse e-mail", async () => {
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { email: 'quelquun@exemple.fr' }) as any,
      })

      expect(corpsEnregistre()).toEqual({ email: '***@exemple.fr' })
    })
  })

  describe('détail des champs refusés par la validation', () => {
    const erreurValidation = (errors: Record<string, string>) =>
      Object.assign(new Error('Données invalides'), {
        data: { errors, message: 'Veuillez corriger les erreurs de saisie' },
      })

    it('ajoute au message le champ fautif et sa raison', async () => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})

      await logApiError({
        error: erreurValidation({ telephone: 'Format de téléphone invalide' }),
        statusCode: 400,
        event: makeEvent(7) as any,
      })

      expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.message).toBe(
        'Données invalides (telephone: Format de téléphone invalide)'
      )
    })

    it('énumère tous les champs quand plusieurs sont refusés', async () => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})

      await logApiError({
        error: erreurValidation({ pseudo: 'Trop court', email: 'Email invalide' }),
        statusCode: 400,
        event: makeEvent(7) as any,
      })

      const message = prismaMock.apiErrorLog.create.mock.calls[0][0].data.message
      expect(message).toContain('pseudo: Trop court')
      expect(message).toContain('email: Email invalide')
    })

    it('laisse le message intact quand l’erreur ne vient pas de la validation', async () => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})

      await logApiError({ error: new Error('boom'), statusCode: 500, event: makeEvent(7) as any })

      expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.message).toBe('boom')
    })

    it('supporte un `data.errors` vide ou mal formé sans altérer le message', async () => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})

      await logApiError({
        error: Object.assign(new Error('Données invalides'), { data: { errors: {} } }),
        statusCode: 400,
        event: makeEvent(7) as any,
      })

      expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.message).toBe('Données invalides')
    })
  })
})
