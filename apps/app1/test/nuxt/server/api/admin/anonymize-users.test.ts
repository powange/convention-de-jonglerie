import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../../../../server/api/admin/anonymize-users.post'

const prismaMock = (globalThis as any).prisma

/**
 * L'anonymisation doit couvrir TOUTES les données personnelles portées par `User`.
 *
 * Aucun test ne la surveillait. Chaque champ personnel ajouté au profil doit y être ajouté à
 * la main, et rien ne le rappelle : un oubli laisse une allergie ou un contact d'urgence en
 * clair sur un compte par ailleurs anonymisé, sans que personne ne s'en aperçoive.
 *
 * Ce test fige la liste attendue. Il tombera au prochain champ personnel oublié — ce qui est
 * exactement son rôle.
 */

/** Champs personnels que l'anonymisation doit remettre à néant ou remplacer. */
const CHAMPS_A_EFFACER = [
  'phone',
  'profilePicture',
  'allergies',
  'allergySeverity',
  'emergencyContactName',
  'emergencyContactPhone',
] as const

describe('POST /api/admin/anonymize-users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Le handler se bloque lui-même en production réelle (NODE_ENV=production sans NUXT_ENV),
    // ce qui est précisément le cas sous vitest. On se place en release, comme les
    // environnements où l'anonymisation est prévue.
    vi.stubEnv('NUXT_ENV', 'release')
    // `requireGlobalAdminWithDbCheck` est auto-importé par Nitro : c'est un global, que
    // `vi.mock` ne peut pas intercepter. Même traitement que `readBody` ailleurs.
    ;(global as any).requireGlobalAdminWithDbCheck = vi
      .fn()
      .mockResolvedValue({ id: 1, isGlobalAdmin: true })

    // La transaction est jouée avec le mock Prisma lui-même : c'est le contenu des écritures
    // qui nous intéresse, pas l'atomicité.
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.user.findMany.mockResolvedValue([{ id: 42 }])
    prismaMock.user.update.mockResolvedValue({})
    // Les candidatures à spectacle sont parcourues puis comptées : sans liste, le handler
    // échoue sur `.length` avant d'arriver à ce qu'on veut vérifier.
    prismaMock.showApplication.findMany.mockResolvedValue([])
    prismaMock.showApplication.update?.mockResolvedValue({})
    for (const delegate of Object.values(prismaMock as Record<string, any>)) {
      if (delegate && typeof delegate === 'object' && 'updateMany' in delegate) {
        delegate.updateMany.mockResolvedValue({ count: 0 })
      }
      if (delegate && typeof delegate === 'object' && 'deleteMany' in delegate) {
        delegate.deleteMany.mockResolvedValue({ count: 0 })
      }
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('efface toutes les données personnelles du compte', async () => {
    await handler({ context: { user: { id: 1 } } } as any)

    const ecriture = prismaMock.user.update.mock.calls.at(-1)?.[0]
    expect(ecriture, "aucune écriture sur l'utilisateur").toBeTruthy()

    for (const champ of CHAMPS_A_EFFACER) {
      expect(ecriture.data, `${champ} devrait être effacé`).toHaveProperty(champ, null)
    }
  })

  it("remplace l'identité plutôt que de la vider", async () => {
    await handler({ context: { user: { id: 1 } } } as any)

    const { data } = prismaMock.user.update.mock.calls.at(-1)[0]
    // Email et pseudo portent une contrainte d'unicité : les vider ferait échouer la seconde
    // ligne. Ils sont donc remplacés par une valeur numérotée, pas mis à néant.
    expect(data.email).toMatch(/@example\.com$/)
    expect(data.pseudo).toMatch(/^Utilisateur_/)
    expect(data.nom).toMatch(/^Nom_/)
    expect(data.prenom).toMatch(/^Prenom_/)
  })

  it('épargne les super-administrateurs', async () => {
    await handler({ context: { user: { id: 1 } } } as any)

    const { where } = prismaMock.user.findMany.mock.calls.at(-1)[0]
    expect(where).toMatchObject({ isGlobalAdmin: false })
  })
})
