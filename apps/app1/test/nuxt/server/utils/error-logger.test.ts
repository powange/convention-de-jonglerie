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

  /**
   * Ce que le journal écrit d'un envoi de fichier refusé — constat B5.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * Le journal consigne le corps de toute requête en erreur, et un refus d'envoi — « Type de
   * fichier non autorisé », « Fichier trop volumineux » — est un **400**, donc consigné. Le corps
   * d'un envoi est `{ files: [{ name, type, size, content: base64 }] }` : c'était **le fichier
   * entier**, jusqu'à ~13 Mo de base64, qui partait dans la colonne `body`.
   *
   * `sanitizeBody` ne regardait que les clés de **premier niveau** : `files[0].content` passait tel
   * quel. Chaque mauvais fichier choisi par un utilisateur coûtait donc plusieurs mégaoctets de
   * table — et l'écran d'administration charge cette ligne en entier.
   *
   * Le même trou valait pour un secret imbriqué : `{ user: { password } }` partait en clair. Aucun
   * point d'API n'envoie cette forme aujourd'hui, mais la garde ne l'aurait pas vue.
   *
   * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
   *
   * On lit le corps **réellement écrit** en base, par le même chemin que la production. Un test qui
   * appellerait une fonction de nettoyage exportée mesurerait cette fonction ; ici l'on mesure ce
   * que `logApiError` enregistre, c'est-à-dire ce qui occupe la table.
   *
   * Le témoin est un corps ordinaire, qui doit passer **intact** : sans lui, un nettoyage qui
   * écraserait tout satisferait les autres cas et le journal ne servirait plus à diagnostiquer
   * quoi que ce soit.
   */
  describe('le contenu d’un fichier refusé', () => {
    beforeEach(() => {
      prismaMock.apiErrorLog.create.mockResolvedValue({})
    })

    /** Un envoi tel que les points d'API `/api/files/*` le reçoivent. */
    const envoiDeFichier = (octets: number) => ({
      files: [
        {
          name: 'affiche.png',
          type: 'image/png',
          size: String(octets),
          content: `data:image/png;base64,${'A'.repeat(octets)}`,
        },
      ],
      metadata: { entityId: 7 },
    })

    it('⚠️ EST REMPLACÉ PAR SA TAILLE, et non écrit en entier', async () => {
      await logApiError({
        error: new Error('Type de fichier non autorisé'),
        statusCode: 400,
        event: makeEvent(7, envoiDeFichier(50_000)) as any,
      })

      const corps = corpsEnregistre() as { files: { content: string; name: string }[] }
      expect(corps.files[0].content).toMatch(/^\*\*\*\d+ octets\*\*\*$/)
      // Le reste de la ligne est ce qui sert au diagnostic : on le garde.
      expect(corps.files[0].name).toBe('affiche.png')
    })

    it('⚠️ MASQUE AUSSI UN SECRET IMBRIQUÉ', async () => {
      // La garde ne descendait pas dans les objets : `{ user: { password } }` partait en clair.
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { user: { pseudo: 'alice', password: 'hunter2' } }) as any,
      })

      expect(corpsEnregistre()).toEqual({
        user: { pseudo: 'alice', password: '***REDACTED***' },
      })
    })

    it('laisse un petit contenu lisible', async () => {
      /*
       * TÉMOIN. Un champ nommé `content` n'est pas forcément un fichier : le corps d'un message, le
       * texte d'une publication. Les écraser tous rendrait indiagnosticables les refus qui portent
       * précisément sur eux — « Le message est trop long » sans pouvoir lire le message.
       */
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { content: 'Bonjour tout le monde' }) as any,
      })

      expect(corpsEnregistre()).toEqual({ content: 'Bonjour tout le monde' })
    })

    it('plafonne un corps qui reste trop gros, en gardant les CLÉS', async () => {
      /*
       * Le filet pour ce qu'on n'a pas prévu : un champ de texte très long, un tableau de mille
       * lignes. Les clés suffisent presque toujours au diagnostic, et un corps tronqué au milieu
       * d'une chaîne ne serait plus du JSON valide dans une colonne qui en attend.
       */
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { description: 'x'.repeat(100_000), titre: 'Edition' }) as any,
      })

      const corps = corpsEnregistre() as { __corpsTropGros__?: boolean; champs?: string[] }
      expect(corps.__corpsTropGros__).toBe(true)
      expect(corps.champs).toEqual(['description', 'titre'])
    })

    it('ne boucle pas sur un corps cyclique', async () => {
      /*
       * La journalisation est le code qu'on appelle quand quelque chose va DÉJÀ mal : y boucler
       * indéfiniment transformerait une erreur en serveur figé. Le parcours est borné par un
       * `WeakSet` et une profondeur.
       */
      const cyclique: Record<string, unknown> = { nom: 'boucle' }
      cyclique.moi = cyclique

      await expect(
        logApiError({
          error: new Error('boom'),
          statusCode: 400,
          event: makeEvent(7, cyclique) as any,
        })
      ).resolves.toBeUndefined()

      expect(corpsEnregistre()).toMatchObject({ nom: 'boucle', moi: '***CYCLE***' })
    })

    it('garde un corps ordinaire intact', async () => {
      /*
       * LE TÉMOIN PRINCIPAL. Sans lui, un nettoyage qui écraserait tout satisferait les cas
       * ci-dessus — et le journal ne servirait plus à diagnostiquer quoi que ce soit.
       */
      await logApiError({
        error: new Error('boom'),
        statusCode: 400,
        event: makeEvent(7, { name: 'Edition 2026', services: ['douches', 'parking'] }) as any,
      })

      expect(corpsEnregistre()).toEqual({
        name: 'Edition 2026',
        services: ['douches', 'parking'],
      })
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
