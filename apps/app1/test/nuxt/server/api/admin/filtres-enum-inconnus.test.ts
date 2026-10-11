import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validatePagination: () => ({ page: 1, limit: 20, skip: 0 }),
}))

import retours from '../../../../../server/api/admin/feedback/index.get'
import notifications from '../../../../../server/api/admin/notifications/recent.get'
import { global } from '../../../globales-nitro'

/**
 * Un filtre inconnu ne doit pas emporter la requête — constat B8.
 *
 * ## Ce qui était mesuré
 *
 * Les deux écrans recopiaient un paramètre d'URL dans le `where` d'une colonne `enum`. Relevé en
 * interrogeant vraiment la base de développement :
 *
 * ```
 * feedback type=PIZZA      → PrismaClientValidationError : Invalid value for argument `type`.
 * notification type=PIZZA  → PrismaClientValidationError : Invalid value for argument `type`.
 * ```
 *
 * Prisma rejette la requête **entière** : liste vide, 500 au journal, écran muet.
 *
 * ## ⚠️ POURQUOI CES TESTS MESURENT LE `where` ET NON LA RÉPONSE
 *
 * Le mock central **ignore le `where`** : il rend la même chose quoi qu'on lui demande. Un test
 * qui appellerait le point d'API avec `?type=PIZZA` et constaterait une réponse 200 serait donc
 * **vert avec le défaut en place** — c'est le vrai Prisma qui lève, pas le mock. La seule prise
 * est ce qui lui est TRANSMIS.
 */
const prismaMock = (globalThis as any).prisma

const appelerRetours = (query: Record<string, unknown>) => {
  global.getQuery = vi.fn().mockReturnValue(query)
  return retours({ context: {} } as any)
}

const appelerNotifications = (query: Record<string, unknown>) => {
  global.getQuery = vi.fn().mockReturnValue(query)
  return notifications({ context: {} } as any)
}

const whereDesRetours = () => prismaMock.feedback.findMany.mock.calls[0][0].where
const whereDesNotifications = () => prismaMock.notification.findMany.mock.calls[0][0].where

describe('GET /api/admin/feedback — filtres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.feedback.findMany.mockResolvedValue([])
    prismaMock.feedback.count.mockResolvedValue(0)
    prismaMock.feedback.groupBy.mockResolvedValue([])
  })

  it('⚠️ UN TYPE INCONNU N’ATTEINT PAS LA REQUÊTE', async () => {
    await appelerRetours({ type: 'PIZZA' })

    expect('type' in whereDesRetours(), 'la valeur inconnue est recopiée dans le `where`').toBe(
      false
    )
  })

  it('⚠️ LE TÉMOIN : un type CONNU filtre bien', async () => {
    /*
     * Sans lui, le cas précédent serait satisfait par un filtre purement et simplement
     * supprimé — la liste répondrait toujours tout, et le test resterait vert en ne couvrant
     * plus rien.
     */
    await appelerRetours({ type: 'BUG' })

    expect(whereDesRetours().type).toBe('BUG')
  })

  it('un statut inconnu est ignoré, un statut connu filtre', async () => {
    await appelerRetours({ status: 'OPEN' })
    expect('status' in whereDesRetours()).toBe(false)

    vi.clearAllMocks()
    prismaMock.feedback.findMany.mockResolvedValue([])
    prismaMock.feedback.count.mockResolvedValue(0)
    prismaMock.feedback.groupBy.mockResolvedValue([])
    await appelerRetours({ status: 'RESOLVED' })
    expect(whereDesRetours().status).toBe('RESOLVED')
  })

  it('un paramètre répété dans l’adresse est ignoré, pas recopié', async () => {
    /*
     * `?type=BUG&type=BUG` : `getQuery` rend un TABLEAU, et un tableau dans un `where` fait
     * lever Prisma exactement comme une valeur inconnue. Une garde écrite sur `string` seul
     * laisserait passer ce cas — il ne vient pas de l'écran, mais d'une adresse bricolée.
     */
    await appelerRetours({ type: ['BUG', 'BUG'] })

    expect('type' in whereDesRetours()).toBe(false)
  })

  it('la recherche textuelle n’est pas touchée par la garde', async () => {
    // Témoin de non-régression : `search` est du texte libre, il doit continuer de passer.
    await appelerRetours({ search: 'carte' })

    expect(whereDesRetours().OR).toContainEqual({ subject: { contains: 'carte' } })
  })
})

describe('GET /api/admin/notifications/recent — filtres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
  })

  it('⚠️ UN TYPE INCONNU N’ATTEINT PAS LA REQUÊTE', async () => {
    await appelerNotifications({ type: 'PIZZA' })

    expect('type' in whereDesNotifications()).toBe(false)
  })

  it('⚠️ LE TÉMOIN : un type CONNU filtre bien', async () => {
    await appelerNotifications({ type: 'WARNING' })

    expect(whereDesNotifications().type).toBe('WARNING')
  })

  it('la catégorie reste du texte libre', async () => {
    /*
     * `Notification.category` est une `String?`, pas une énumération — la garder libre est
     * voulu. L'étendre à la liste des catégories connues REFUSERAIT les catégories posées par
     * les modules, qui s'écrivent sans registre central.
     */
    await appelerNotifications({ category: 'volunteer' })

    expect(whereDesNotifications().category).toBe('volunteer')
  })
})
