import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import handler from '../../../../../server/api/admin/conventions.get'
import { global } from '../../../globales-nitro'

/**
 * La liste des conventions de l'administration — constat O3.
 *
 * ## Le défaut
 *
 * UN `findMany` sans `take` ni `skip`, avec pour chaque convention l'auteur, tous les
 * organisateurs (profil compris), toutes les éditions (créateur, trois `_count`, et le compte de
 * candidatures via `Event`). La page ne faisait que **filtrer et trier en mémoire** ce tableau
 * complet. C'était le seul écran d'administration à liste longue sans pagination — utilisateurs,
 * retours, journal d'erreurs et notifications en ont une.
 *
 * 📊 Mesuré : 71 conventions, 70 éditions, 95 organisateurs. Le volume est modeste aujourd'hui,
 * et le coût croît avec chaque édition importée.
 *
 * ## ⚠️ ET LES ADRESSES DE COURRIEL PARTAIENT POUR RIEN
 *
 * L'écran n'en affiche aucune : elles ne servaient qu'au filtre de recherche, exécuté **côté
 * client** — donc tout le trousseau d'adresses des auteurs et des créateurs voyageait pour cela.
 * La recherche porte désormais sur `author.email` dans le `where` : la fonctionnalité est gardée,
 * et l'adresse ne quitte plus la base. C'est le cas le plus important de ce fichier.
 *
 * ## ⚠️ POURQUOI LES CAS MESURENT LA REQUÊTE
 *
 * Le mock Prisma **ignore le `where`, le `skip` et le `take`** : il rend la même chose quoi qu'on
 * lui demande. Un cas qui compterait les lignes rendues serait donc vert avec ou sans pagination.
 * La seule prise est ce qui est **transmis**.
 */
const prismaMock = (globalThis as any).prisma

const appeler = (requete: Record<string, unknown> = {}) => {
  global.getQuery = vi.fn().mockReturnValue(requete)
  return handler({ context: {} } as any)
}

const requete = () => prismaMock.convention.findMany.mock.calls[0][0]

describe('GET /api/admin/conventions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.convention.findMany.mockResolvedValue([])
    prismaMock.convention.count.mockResolvedValue(71)
    prismaMock.edition.count.mockResolvedValue(70)
  })

  it('⚠️ DEMANDE UNE PAGE, PAS TOUTE LA TABLE', async () => {
    await appeler({ page: '2' })

    expect(requete().take, 'aucune borne : toute la table repart').toBeGreaterThan(0)
    expect(requete().skip, 'la page demandée est ignorée').toBeGreaterThan(0)
  })

  it('⚠️ NE RENVOIE AUCUNE ADRESSE DE COURRIEL', async () => {
    /*
     * LE CAS LE PLUS IMPORTANT. L'écran n'en affiche pas une seule, et elles ne servaient qu'au
     * filtre client. Les laisser dans le `select` les ferait voyager pour rien.
     */
    await appeler()

    const include = requete().include
    expect('email' in include.author.select, 'l’adresse de l’auteur repart').toBe(false)
    expect(
      'email' in include.editions.include.creator.select,
      'l’adresse du créateur d’édition repart'
    ).toBe(false)
  })

  it('⚠️ LE TÉMOIN : la recherche porte TOUJOURS sur l’adresse, côté serveur', async () => {
    /*
     * Sans lui, retirer l'adresse du `select` serait satisfait par un correctif qui aurait aussi
     * SUPPRIMÉ la recherche par adresse — une fonctionnalité perdue en silence, au nom d'une
     * optimisation.
     */
    await appeler({ search: 'lea@exemple.fr' })

    const ou = requete().where.OR as Array<Record<string, any>>
    expect(ou.some((c) => c.author?.email?.contains === 'lea@exemple.fr')).toBe(true)
  })

  it('cherche aussi dans le nom, la description, le pseudo et les éditions', async () => {
    await appeler({ search: 'lyon' })

    const ou = requete().where.OR as Array<Record<string, any>>
    expect(ou.some((c) => c.name?.contains === 'lyon')).toBe(true)
    expect(ou.some((c) => c.description?.contains === 'lyon')).toBe(true)
    expect(ou.some((c) => c.author?.pseudo?.contains === 'lyon')).toBe(true)
    expect(ou.some((c) => c.editions?.some?.city?.contains === 'lyon')).toBe(true)
  })

  it('traduit les trois filtres d’état', async () => {
    await appeler({ archived: 'active' })
    expect(requete().where.isArchived).toBe(false)

    vi.clearAllMocks()
    prismaMock.convention.findMany.mockResolvedValue([])
    prismaMock.convention.count.mockResolvedValue(0)
    prismaMock.edition.count.mockResolvedValue(0)
    await appeler({ archived: 'unclaimed' })
    // `none` et non un compte à zéro, que Prisma ne sait pas filtrer.
    expect(requete().where.organizers).toEqual({ none: {} })
  })

  it('⚠️ UN FILTRE OU UN TRI INCONNU NE FAIT PAS TOMBER LA REQUÊTE', async () => {
    // Même règle que le constat B8 : une valeur inconnue est ignorée, pas recopiée.
    await appeler({ archived: 'PIZZA', sort: 'PIZZA' })

    expect('isArchived' in requete().where).toBe(false)
    expect(requete().orderBy).toEqual({ name: 'asc' })
  })

  it('trie par nombre d’éditions sans charger les éditions pour compter', async () => {
    await appeler({ sort: 'editions-desc' })

    expect(requete().orderBy).toEqual({ editions: { _count: 'desc' } })
  })

  it('⚠️ LES TROIS COMPTEURS DE L’EN-TÊTE SONT GLOBAUX, pas ceux de la page', async () => {
    /*
     * Ils étaient calculés côté client sur la liste complète. Paginer sans les déplacer les
     * aurait rendus faux EN SILENCE : « 20 conventions » sur chaque page. Et ils ignorent le
     * filtre, comme avant — ce sont des totaux de l'instance.
     */
    prismaMock.convention.count.mockResolvedValue(71)
    prismaMock.edition.count.mockResolvedValue(70)

    const reponse: any = await appeler({ search: 'lyon' })

    expect(reponse.totaux).toEqual({ conventions: 71, editions: 70, actives: 71 })
    expect(reponse.pagination.totalCount).toBe(71)
  })
})
