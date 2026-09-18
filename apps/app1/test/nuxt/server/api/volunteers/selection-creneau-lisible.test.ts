import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/permissions/volunteer-permissions', () => ({
  requireVolunteerPlanningAccess: vi.fn(),
  isAcceptedVolunteer: vi.fn(async () => true),
}))

// Le planning doit être publié pour que le point d'API aille jusqu'à sa requête ; ce n'est pas
// ce qu'on éprouve ici.
vi.mock('../../../../../../../layers/volunteers/server/utils/planning-publie', () => ({
  exigerPlanningPublie: vi.fn(async () => undefined),
  visibiliteDuPlanning: vi.fn(async () => ({ niveau: 'complet', equipesEnDetail: [] })),
}))

import { selectionCreneauLisible } from '../../../../../../../layers/volunteers/server/utils/selection-creneau-lisible'
import candidats from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/swaps/candidates.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

/**
 * Le retard d'un créneau (`delayMinutes`) ne peut pas s'afficher s'il n'est pas demandé.
 *
 * Quatre points d'API décrivaient la même sélection chacun de leur côté, et les quatre
 * l'omettaient : les écrans d'échange annonçaient donc l'heure enregistrée, pas l'heure réelle.
 * Une règle recopiée quatre fois est une règle qu'on corrigera trois fois.
 *
 * Ces tests portent sur la REQUÊTE envoyée à la base, et non sur ce que le mock veut bien rendre —
 * un mock rendrait de toute façon ce qu'on lui dit.
 */
describe('la sélection partagée d’un créneau annonçable', () => {
  it('demande le retard', () => {
    // Sans ce champ, aucune des six surfaces ne peut corriger l'heure affichée.
    expect(selectionCreneauLisible.delayMinutes).toBe(true)
  })

  it('demande de quoi nommer et situer le créneau', () => {
    expect(selectionCreneauLisible.startDateTime).toBe(true)
    expect(selectionCreneauLisible.endDateTime).toBe(true)
    expect(selectionCreneauLisible.title).toBe(true)
    expect(selectionCreneauLisible.team).toBeDefined()
  })

  it('ne demande PAS les personnes affectées', () => {
    // Ce qui est décrit ici sert à nommer un créneau, pas à dire qui le tient. Y glisser les
    // personnes ferait voyager des identités vers des écrans qui n'en ont pas besoin, sans que
    // les règles de confidentialité de chaque point d'API aient leur mot à dire.
    expect(selectionCreneauLisible).not.toHaveProperty('assignments')
    expect(selectionCreneauLisible).not.toHaveProperty('organizerAssignments')
  })
})

describe('les points d’API d’échange demandent bien le retard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // `getQuery` lit l'URL de l'événement : le test la fournit par la globale Nitro, comme le
    // fait déjà la suite des échanges.
    global.getQuery = vi.fn(() => ({ assignmentId: 'aff-1' }))
    // Le point d'API sort tôt si l'affectation offerte est introuvable, ou si la personne n'a
    // aucune équipe : sans ces deux réponses, la requête qu'on veut observer n'est jamais émise.
    prismaMock.volunteerAssignment.findFirst.mockResolvedValue({
      id: 'aff-1',
      timeSlot: { id: 'creneau-1', teamId: 'accueil' },
    })
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([{ teamId: 'accueil' }])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
  })

  it('candidates.get le demande sur le créneau', async () => {
    await candidats(evenement as any).catch(() => undefined)

    const appels = prismaMock.volunteerAssignment.findMany.mock.calls
    const avecCreneau = appels.find((appel: any[]) => appel[0]?.select?.timeSlot?.select)
    expect(avecCreneau, 'aucune requête ne sélectionne de créneau').toBeDefined()
    expect(avecCreneau![0].select.timeSlot.select.delayMinutes).toBe(true)
  })
})
