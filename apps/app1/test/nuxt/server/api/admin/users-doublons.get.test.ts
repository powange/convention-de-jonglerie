import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireGlobalAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireGlobalAdmin,
}))

import handler from '../../../../../server/api/admin/users/doublons.get'

const prismaMock = (globalThis as any).prisma

/*
 * Les pseudos sont donnés en clair et distincts à dessein : la règle des pseudos voisins retire
 * les chiffres de fin, si bien qu'un fixture nommé « pseudo1 », « pseudo2 »… se rapprocherait de
 * lui-même et ajouterait une grappe qu'aucun test n'a demandée.
 */
const compte = (id: number, p: Record<string, unknown> = {}) => ({
  id,
  email: `u${id}@exemple.fr`,
  pseudo: `zeta${id}`,
  nom: null,
  prenom: null,
  phone: null,
  createdAt: new Date('2026-01-01'),
  ...p,
})

const event = { context: {} }

describe('GET /api/admin/users/doublons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireGlobalAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.user.findMany.mockReset()
  })

  /* La route expose des adresses e-mail : sans cette garde, n'importe qui les lirait. */
  it("exige un administrateur global avant d'interroger la base", async () => {
    mockRequireGlobalAdmin.mockRejectedValue(new Error('Accès refusé'))
    // Le libellé n'est pas vérifié : `wrapApiHandler` réécrit toute erreur en « Erreur serveur
    // interne ». Ce qui compte, c'est que la base ne soit JAMAIS interrogée.
    await expect(handler(event as any)).rejects.toThrow()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('rend les grappes et le nombre de comptes examinés', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      compte(1, { email: 'jean.dupont@gmail.com', pseudo: 'Alpha' }),
      compte(2, { email: 'jeandupont+asso@gmail.com', pseudo: 'Beta' }),
      compte(3, { email: 'sansrapport@exemple.fr', pseudo: 'Gamma' }),
    ])

    const resultat = await handler(event as any)

    expect(resultat.comptesExamines).toBe(3)
    expect(resultat.grappes).toHaveLength(1)
    expect(resultat.grappes[0]).toMatchObject({ motif: 'boite', comptes: [1, 2] })
  })

  /*
   * Seuls les comptes rapprochés accompagnent la réponse.
   *
   * Renvoyer tout le fichier enverrait au navigateur des centaines d'adresses que l'écran
   * n'affichera jamais — et les redemander une par une ferait autant d'appels que de lignes.
   */
  it('ne renvoie que les comptes concernés par une grappe', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      compte(1, { email: 'jean.dupont@gmail.com', pseudo: 'Alpha' }),
      compte(2, { email: 'jeandupont@gmail.com', pseudo: 'Beta' }),
      compte(3, { email: 'sansrapport@exemple.fr', pseudo: 'Gamma' }),
    ])

    const resultat = await handler(event as any)

    expect(resultat.comptes.map((c: { id: number }) => c.id)).toEqual([1, 2])
    expect(resultat.comptesExamines).toBe(3)
  })

  it('rend une réponse vide et honnête quand rien ne se ressemble', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      compte(1, { email: 'alice@exemple.fr', pseudo: 'Alice' }),
      compte(2, { email: 'bob@exemple.fr', pseudo: 'Bob' }),
    ])

    const resultat = await handler(event as any)

    expect(resultat.grappes).toEqual([])
    expect(resultat.comptes).toEqual([])
    expect(resultat.comptesExamines).toBe(2)
  })
})
