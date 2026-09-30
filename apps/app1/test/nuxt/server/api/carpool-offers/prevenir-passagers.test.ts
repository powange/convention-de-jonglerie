import { describe, it, expect, beforeEach, vi } from 'vitest'

const offreSupprimee = vi.hoisted(() => vi.fn(async () => ({ id: 'n1' })))
const offreModifiee = vi.hoisted(() => vi.fn(async () => ({ id: 'n2' })))

vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationHelpers: {
    carpoolOfferDeleted: offreSupprimee,
    carpoolOfferChanged: offreModifiee,
  },
  // La vraie mécanique de `safeNotify` est conservée : l'un des tests éprouve précisément le fait
  // qu'une notification en échec ne fasse pas échouer la suppression.
  safeNotify: async (operation: () => Promise<unknown>) => {
    try {
      return await operation()
    } catch {
      return null
    }
  },
}))

import supprimer from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/index.delete'
import modifier from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/index.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Supprimer ou déplacer un trajet prévient ceux qui l'avaient réservé.
 *
 * ⚠️ CE QUI MANQUAIT, et pourquoi c'était grave. Un passager acceptait une place, organisait son
 * week-end autour du trajet, puis le conducteur supprimait son offre : le `CASCADE` emportait la
 * réservation, et le passager n'apprenait RIEN. Il se présentait au rendez-vous. Aucune trace,
 * aucun message, aucune erreur — le silence parfait.
 *
 * ⚠️ L'ORDRE EST LE CŒUR DU CORRECTIF. `CarpoolBooking` est en `onDelete: Cascade` : lire les
 * réservations après le `delete` rendrait un tableau vide et ne préviendrait personne, tout en
 * ayant l'air corrigé. C'est ce que le premier test vérifie, et il tombe si la lecture passe après.
 */

const CONDUCTEUR = 1
const PASSAGER_ACCEPTE = 2
const DEMANDEUR_EN_ATTENTE = 3
const OFFRE = 1
const EDITION = 7

const offre = {
  id: OFFRE,
  editionId: EDITION,
  userId: CONDUCTEUR,
  tripDate: new Date('2026-07-15T08:00:00Z'),
  locationCity: 'Paris',
  availableSeats: 3,
  user: { id: CONDUCTEUR, pseudo: 'Conducteur' },
}

const evenement = {
  context: {
    params: { id: String(OFFRE) },
    user: { id: CONDUCTEUR, pseudo: 'Conducteur', isGlobalAdmin: false },
  },
}

describe('DELETE /api/carpool-offers/[id] — prévenir les passagers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(OFFRE))
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre)
    prismaMock.carpoolOffer.delete.mockResolvedValue(offre)
    prismaMock.carpoolBooking.findMany.mockResolvedValue([
      { requesterId: PASSAGER_ACCEPTE, seats: 2 },
      { requesterId: DEMANDEUR_EN_ATTENTE, seats: 1 },
    ])
  })

  it('lit les réservations AVANT de supprimer, pas après', async () => {
    /*
     * Le test central. `CASCADE` fait que l'ordre inverse ne préviendrait personne — et
     * n'échouerait pas : la suppression réussirait, le tableau serait vide, et le défaut resterait
     * entier sous un code qui a l'air de le corriger.
     *
     * On mesure donc l'ordre lui-même, en enregistrant le moment de chaque appel.
     */
    const ordre: string[] = []
    prismaMock.carpoolBooking.findMany.mockImplementation(async () => {
      ordre.push('lecture')
      return [{ requesterId: PASSAGER_ACCEPTE, seats: 2 }]
    })
    prismaMock.carpoolOffer.delete.mockImplementation(async () => {
      ordre.push('suppression')
      return offre
    })

    await supprimer(evenement as any)

    expect(ordre).toEqual(['lecture', 'suppression'])
  })

  it('prévient les acceptés ET les demandes en attente', async () => {
    /*
     * Un demandeur en attente n'a pas de place, mais il attend une réponse qui ne viendra jamais.
     * Sans notification, il l'attend indéfiniment au lieu de chercher un autre trajet — l'offre
     * a simplement disparu de la liste, ce qui ne se remarque pas.
     */
    await supprimer(evenement as any)

    const destinataires = offreSupprimee.mock.calls.map((appel) => appel[0])
    expect(destinataires).toContain(PASSAGER_ACCEPTE)
    expect(destinataires).toContain(DEMANDEUR_EN_ATTENTE)
  })

  it('ne demande que les réservations ACCEPTÉES et EN ATTENTE', async () => {
    // Prévenir un refusé ou un désisté serait une nouvelle sans objet : il n'avait plus de trajet.
    await supprimer(evenement as any)

    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          carpoolOfferId: OFFRE,
          status: { in: ['ACCEPTED', 'PENDING'] },
        }),
      })
    )
  })

  it('passe l’édition, et non l’offre, pour construire le lien', async () => {
    /*
     * L'offre n'existe plus : un lien vers elle mènerait à « introuvable ». Envoyer quelqu'un sur
     * une page morte juste après lui avoir annoncé qu'il perd sa place ajouterait l'insulte au
     * dommage. Le lien mène donc à la liste de covoiturage de l'édition.
     */
    await supprimer(evenement as any)

    expect(offreSupprimee).toHaveBeenCalledWith(PASSAGER_ACCEPTE, 'Conducteur', EDITION, 2, 'Paris')
  })

  it('supprime quand même si une notification échoue', async () => {
    /*
     * L'invariant qui protège l'essentiel : la suppression est ce que l'utilisateur a demandé. La
     * voir échouer parce qu'un envoi a raté serait un défaut plus grave que l'absence d'envoi.
     */
    offreSupprimee.mockRejectedValue(new Error('service indisponible'))

    const reponse: any = await supprimer(evenement as any)

    expect(reponse.success).toBe(true)
    expect(prismaMock.carpoolOffer.delete).toHaveBeenCalled()
  })

  it('ne prévient personne quand l’offre n’avait aucune réservation', async () => {
    // Le cas de loin le plus fréquent. Il ne doit coûter aucun envoi.
    prismaMock.carpoolBooking.findMany.mockResolvedValue([])

    await supprimer(evenement as any)

    expect(offreSupprimee).not.toHaveBeenCalled()
  })
})

describe('PUT /api/carpool-offers/[id] — prévenir d’un changement décisif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(OFFRE))
    global.readBody = vi.fn().mockResolvedValue({})
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offre)
    prismaMock.carpoolBooking.findMany.mockResolvedValue([{ requesterId: PASSAGER_ACCEPTE }])
    prismaMock.carpoolOffer.update.mockImplementation(async ({ data }: any) => ({
      ...offre,
      ...data,
    }))
  })

  it('prévient quand la VILLE de départ change', async () => {
    global.readBody = vi.fn().mockResolvedValue({ locationCity: 'Lyon' })

    await modifier(evenement as any)

    expect(offreModifiee).toHaveBeenCalledWith(
      PASSAGER_ACCEPTE,
      'Conducteur',
      OFFRE,
      EDITION,
      'Lyon',
      expect.any(Date)
    )
  })

  it('prévient quand la DATE du trajet change', async () => {
    global.readBody = vi.fn().mockResolvedValue({ tripDate: '2026-07-16T08:00:00Z' })

    await modifier(evenement as any)

    expect(offreModifiee).toHaveBeenCalled()
  })

  it('ne prévient PAS pour une modification indifférente au passager', async () => {
    /*
     * Le tri est la moitié du travail. Prévenir pour une description retouchée ou une place en plus
     * apprendrait aux passagers à ignorer ces messages — et le jour où la date change vraiment,
     * plus personne ne les lit. Une notification de trop en dévalue toutes les autres.
     */
    global.readBody = vi.fn().mockResolvedValue({
      description: 'Je passe par l’autoroute',
      availableSeats: 4,
    })

    await modifier(evenement as any)

    expect(offreModifiee).not.toHaveBeenCalled()
  })

  it('ne prévient pas quand la date est RÉÉCRITE à l’identique', async () => {
    /*
     * Enregistrer le formulaire sans y toucher renvoie la même date, sous la forme d'une autre
     * instance de `Date`. Comparer les objets — ou seulement la présence du champ — enverrait une
     * notification à chaque enregistrement. La comparaison porte donc sur l'instant.
     */
    global.readBody = vi.fn().mockResolvedValue({ tripDate: '2026-07-15T08:00:00Z' })

    await modifier(evenement as any)

    expect(offreModifiee).not.toHaveBeenCalled()
  })

  it('ne prévient pas quand la ville est réécrite à l’identique', async () => {
    global.readBody = vi.fn().mockResolvedValue({ locationCity: 'Paris' })

    await modifier(evenement as any)

    expect(offreModifiee).not.toHaveBeenCalled()
  })

  it('n’interroge même pas les réservations sans changement décisif', async () => {
    // Le cas courant ne doit pas payer une requête pour rien.
    global.readBody = vi.fn().mockResolvedValue({ description: 'Bagages légers' })

    await modifier(evenement as any)

    expect(prismaMock.carpoolBooking.findMany).not.toHaveBeenCalled()
  })

  it('ne prévient que les ACCEPTÉS, pas les demandes en attente', async () => {
    /*
     * Différence assumée avec la suppression : un demandeur en attente n'a pas de trajet à
     * réorganiser, et il verra la nouvelle date sur l'offre quand on lui répondra. Lui écrire pour
     * un trajet qu'il n'a pas encore serait du bruit.
     */
    global.readBody = vi.fn().mockResolvedValue({ locationCity: 'Lyon' })

    await modifier(evenement as any)

    expect(prismaMock.carpoolBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    )
  })
})
