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

/** Les conditions du `AND` : une par mot-clé cherché */
const conditionsParMotCle = () => filtreApplique().AND ?? []

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

/**
 * La saisie entière était comparée à chaque champ pris isolément : « Camille » trouvait, « Bakker »
 * aussi, mais « Camille Bakker » ne trouvait rien — aucun champ ne porte le prénom ET le nom. Et un
 * espace en trop suffisait à tout faire disparaître.
 */
describe('GET /api/admin/users — recherche par mots-clés', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.user.count.mockResolvedValue(0)
  })

  it('cherche chaque mot séparément, chacun dans n’importe quel champ', async () => {
    await chercher('Camille Bakker')

    const conditions = conditionsParMotCle()
    expect(conditions).toHaveLength(2)
    expect(conditions[0].OR).toContainEqual({ prenom: { contains: 'camille' } })
    expect(conditions[0].OR).toContainEqual({ nom: { contains: 'camille' } })
    expect(conditions[1].OR).toContainEqual({ nom: { contains: 'bakker' } })
    expect(conditions[1].OR).toContainEqual({ prenom: { contains: 'bakker' } })
  })

  it("ne dépend pas de l'ordre des mots", async () => {
    await chercher('camille bakker')
    const ordreDirect = conditionsParMotCle()

    prismaMock.user.findMany.mockClear()
    await chercher('bakker camille')

    // Les mêmes deux contraintes, listées dans l'autre sens : un `AND` n'en a que faire.
    expect(conditionsParMotCle()).toEqual([...ordreDirect].reverse())
  })

  it('ignore les accents et la casse de la saisie', async () => {
    // La base compare en `utf8mb4_unicode_ci`, donc « jerome » retrouve « Jérôme ».
    await chercher('JÉRÔME')

    expect(conditionsParMotCle()[0].OR).toContainEqual({ prenom: { contains: 'jerome' } })
  })

  it('n’est plus mise en échec par un espace de trop', async () => {
    await chercher('  emma  ')

    const conditions = conditionsParMotCle()
    expect(conditions).toHaveLength(1)
    expect(conditions[0].OR).toContainEqual({ pseudo: { contains: 'emma' } })
  })

  it('ne filtre personne sur une saisie qui ne porte aucun mot', async () => {
    await chercher('   ')

    expect(filtreApplique().AND).toBeUndefined()
  })
})
