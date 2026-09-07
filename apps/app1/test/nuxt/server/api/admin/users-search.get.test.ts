import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validatePagination: () => ({ page: 1, limit: 20, skip: 0 }),
}))

vi.mock('#server/utils/notification-stream-manager', () => ({
  notificationStreamManager: { getStats: () => ({ connectionsByUser: [] }) },
}))

import handler from '../../../../../server/api/admin/users/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/** Le `where` transmis à `prisma.user.findMany` */
const filtreApplique = () => prismaMock.user.findMany.mock.calls[0][0].where

/** Les branches du `OR` de recherche textuelle */
const branchesDeRecherche = () => {
  const et = filtreApplique().AND ?? []
  return et.flatMap((condition: any) => condition.OR ?? [])
}

const chercher = (search: string) => {
  global.getQuery = vi.fn().mockReturnValue({ search })
  return handler({ context: {} } as any)
}

describe('GET /api/admin/users — recherche', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.user.count.mockResolvedValue(0)
  })

  it("cherche aussi par identifiant quand la saisie n'est que des chiffres", async () => {
    // C'est ce dont on dispose en arrivant depuis le journal d'erreurs : un identifiant,
    // pas un pseudo.
    await chercher('42')

    expect(branchesDeRecherche()).toContainEqual({ id: 42 })
  })

  it('cherche toujours dans les champs textuels, identifiant ou non', async () => {
    // « 42 » doit trouver l'utilisateur 42 comme celui dont le pseudo contient 42.
    await chercher('42')

    const branches = branchesDeRecherche()
    expect(branches).toContainEqual({ pseudo: { contains: '42' } })
    expect(branches).toContainEqual({ email: { contains: '42' } })
  })

  it('ne cherche pas par identifiant sur une saisie textuelle', async () => {
    await chercher('marie')

    const branches = branchesDeRecherche()
    expect(branches.some((branche: any) => 'id' in branche)).toBe(false)
    expect(branches).toContainEqual({ pseudo: { contains: 'marie' } })
  })

  it('ignore un nombre trop grand pour être un identifiant', async () => {
    // Au-delà des entiers sûrs, `Number` perd de la précision : chercher un identifiant
    // approché rendrait un résultat faux plutôt qu'aucun.
    await chercher('99999999999999999999')

    expect(branchesDeRecherche().some((branche: any) => 'id' in branche)).toBe(false)
  })
})
