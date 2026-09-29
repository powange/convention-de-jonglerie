import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler, validateEditionId et validateResourceId sont auto-importés (Nitro).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
  if (!(globalThis as any).validateResourceId) {
    ;(globalThis as any).validateResourceId = (event: any, name: string) =>
      parseInt(event?.context?.params?.[name], 10)
  }
})

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1 })),
}))

vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageMealsOrValidation: vi.fn(async () => true),
}))

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({
    artists: {
      listMealArtistSelections: vi.fn(async () => []),
      countMealArtistSelections: vi.fn(async () => ({ total: 0, validated: 0, afterShow: 0 })),
    },
    ticketing: {
      listMealTicketParticipants: vi.fn(async () => []),
    },
  })),
}))

import { global } from '../../../../globales-nitro'
import validateHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/validate.post'
import cancelHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/cancel.post'
import statsHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/stats.get'
import pendingHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/pending.get'
import searchHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/[mealId]/search.get'
import listeHandler from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/index.get'

const prismaMock = (globalThis as any).prisma

/**
 * Un repas désactivé n'est plus servi ni compté au comptoir.
 *
 * Le défaut : l'organisateur décoche « dîner du jeudi » — il dit à la cuisine de ne pas le
 * préparer —, et le comptoir continuait de le proposer dans ses flèches jour/type, de compter ses
 * totaux et d'y valider des personnes. Rien ne le signalait : la barre de progression affichait un
 * service inexistant, et les tickets repas partaient.
 *
 * ⚠️ LE DÉFAUT ÉTAIT À MOITIÉ INVISIBLE, et c'est ce qui l'a fait survivre : désactiver un repas
 * SUPPRIME les sélections des bénévoles et des artistes, qui disparaissaient donc des listes. Seuls
 * restaient servables les ORGANISATEURS — leur droit est implicite, sans ligne en base — et les
 * BILLETS, rattachés au tarif. Un test qui n'aurait regardé que les bénévoles serait resté vert.
 *
 * La garde est portée par `assurerRepasServiAuComptoir`, un seul util pour les quatre points d'API,
 * et elle LIT `enabled` au lieu de l'ajouter au `where` : le mock de Prisma ignore le `where`, une
 * garde écrite ainsi n'aurait pu être éprouvée qu'en assertant la forme de la requête — ici on
 * éprouve le refus lui-même.
 */

const EDITION = 17
const REPAS = 3

const evenement = { context: { params: { id: String(EDITION), mealId: String(REPAS) } } }

const repasDesactive = { enabled: false }
const repasActive = { enabled: true }

describe('les points d’API qui servent ou comptent un repas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ type: 'organizer', id: 5 })
    global.getQuery = vi.fn().mockReturnValue({ type: 'organizer', q: 'dupont' })

    prismaMock.volunteerMeal.findFirst.mockReset()
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.volunteerMealSelection.count.mockResolvedValue(0)
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
    prismaMock.organizerMealSelection.count.mockResolvedValue(0)
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItemMeal.count.mockResolvedValue(0)
  })

  it('refuse la VALIDATION sur un repas désactivé, sans rien écrire', async () => {
    prismaMock.volunteerMeal.findFirst.mockResolvedValue(repasDesactive)

    await expect(validateHandler(evenement as any)).rejects.toMatchObject({
      status: 400,
      message: 'Ce repas est désactivé',
    })
    // Le refus doit précéder l'écriture : un 400 rendu après avoir posé consumedAt aurait servi le
    // repas tout en disant l'avoir refusé.
    expect(prismaMock.organizerMealSelection.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.organizerMealSelection.create).not.toHaveBeenCalled()
  })

  it('distingue « désactivé » (400) de « introuvable » (404)', async () => {
    // Deux causes, deux messages : au comptoir, l'un s'explique par un réglage à changer sur la
    // page de configuration, l'autre par une adresse erronée. Les confondre envoie chercher au
    // mauvais endroit.
    prismaMock.volunteerMeal.findFirst.mockResolvedValue(null)

    await expect(validateHandler(evenement as any)).rejects.toMatchObject({
      status: 404,
      message: 'Repas non trouvé',
    })
  })

  it('laisse passer un repas ACTIVÉ', async () => {
    // Le garde-fou doit se taire dans le cas nominal — sans ce cas, un refus systématique passerait
    // pour une correction réussie.
    prismaMock.volunteerMeal.findFirst.mockResolvedValue(repasActive)

    await validateHandler(evenement as any)

    expect(prismaMock.organizerMealSelection.updateMany).toHaveBeenCalled()
  })

  it.each([
    ['les statistiques', statsHandler],
    ['les non-validés', pendingHandler],
    ['la recherche', searchHandler],
  ])('refuse aussi %s sur un repas désactivé', async (_nom, handler) => {
    // Ces trois-là ne valident rien, mais ils alimentent l'écran : les laisser répondre afficherait
    // une barre de progression et une liste de personnes attendues pour un service inexistant.
    prismaMock.volunteerMeal.findFirst.mockResolvedValue(repasDesactive)

    await expect(handler(evenement as any)).rejects.toMatchObject({
      status: 400,
      message: 'Ce repas est désactivé',
    })
  })

  it('la liste des repas du comptoir ne demande QUE les repas activés', async () => {
    // Ici la restriction vit dans le `where`, que le mock ignore : elle se vérifie donc sur la
    // requête envoyée, faute de quoi le test resterait vert avec le filtre retiré.
    prismaMock.volunteerMeal.findMany.mockResolvedValue([])

    await listeHandler({ context: { params: { id: String(EDITION) } } } as any)

    expect(prismaMock.volunteerMeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: EDITION, enabled: true },
      })
    )
  })
})

/**
 * L'ANNULATION reste possible sur un repas désactivé — asymétrie voulue, verrouillée ici.
 *
 * Valider SERT un repas ; annuler n'en sert aucun. Si l'on refusait l'annulation, corriger une
 * consommation saisie par erreur juste avant la désactivation obligerait à réactiver le repas — ce
 * qui recrée les sélections des bénévoles et écrase leurs refus. On imposerait une opération
 * destructrice pour réparer une faute de frappe.
 *
 * Ce test existe pour que l'asymétrie soit un choix relu, et non un oubli qu'un prochain lot
 * « corrigerait » en croyant compléter la garde.
 */
describe('POST cancel — sur un repas désactivé', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ type: 'organizer', id: 5 })
    prismaMock.volunteerMeal.findFirst.mockReset()
    prismaMock.organizerMealSelection.updateMany.mockResolvedValue({ count: 1 })
  })

  it('annule quand même la consommation', async () => {
    prismaMock.volunteerMeal.findFirst.mockResolvedValue({ id: REPAS })

    await cancelHandler(evenement as any)

    expect(prismaMock.organizerMealSelection.updateMany).toHaveBeenCalledWith({
      where: { mealId: REPAS, editionOrganizer: { id: 5, editionId: EDITION } },
      data: { consumedAt: null },
    })
  })

  it('refuse toujours un repas d’une autre édition', async () => {
    prismaMock.volunteerMeal.findFirst.mockResolvedValue(null)

    await expect(cancelHandler(evenement as any)).rejects.toMatchObject({ status: 404 })
  })
})
