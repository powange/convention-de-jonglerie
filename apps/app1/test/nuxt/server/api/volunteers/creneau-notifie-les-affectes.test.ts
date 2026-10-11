import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireManagement = vi.fn()
const mockNotify = vi.fn()

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { requireManagementAccess: mockRequireManagement },
    notifications: { notify: mockNotify },
  }),
}))

import modifier from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId].put'
import supprimerCreneau from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId].delete'
import retirerBenevole from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId]/assignments/[assignmentId].delete'
import retirerOrganisateur from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId]/organizer-assignments/[editionOrganizerId].delete'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Prévenir ceux qui tiennent un créneau quand il bouge — constat B4.
 *
 * ## Le défaut
 *
 * Après publication du planning, le bénévole NOTE ses horaires — il peut les exporter en ICS.
 * Pourtant déplacer un créneau, le supprimer, ou en retirer quelqu'un ne produisait **aucune**
 * notification : les quatre points d'API ne portaient pas une seule occurrence de « notif ». Le
 * bénévole se présentait à l'ancien horaire.
 *
 * ## ⚠️ CE QUE CES TESTS DOIVENT MESURER, et pourquoi ce n'est pas évident
 *
 * On ne peut pas vérifier « la notification est partie » en regardant la réponse du point d'API :
 * elle n'en dit rien, et c'est voulu — un envoi raté ne doit pas faire échouer l'écriture. La
 * seule prise est donc **l'appel au port**, et surtout **à qui** il est adressé : le piège de ce
 * lot est un destinataire lu sur le mauvais champ, qui envoie à `undefined` sans lever.
 */
const CRENEAU = {
  id: 'creneau-1',
  eventId: 22,
  startDateTime: new Date('2026-08-01T10:00:00Z'),
  endDateTime: new Date('2026-08-01T12:00:00Z'),
  teamId: 'bar',
  delayMinutes: null,
}

const evenement = { context: { params: { id: '22' }, user: { id: 1 } } } as never

/** Le planning est publié ou non — c'est la première condition de tout envoi. */
function planningPublie(publie: boolean) {
  prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ planningPublished: publie })
}

function affectes({
  benevoles = [],
  organisateurs = [],
}: {
  benevoles?: number[]
  organisateurs?: number[]
}) {
  prismaMock.volunteerAssignment.findMany.mockResolvedValue(benevoles.map((userId) => ({ userId })))
  prismaMock.organizerSlotAssignment.findMany.mockResolvedValue(
    organisateurs.map((userId) => ({ editionOrganizer: { organizer: { userId } } }))
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  global.getRouterParam = vi.fn((_e: any, nom: string) => {
    if (nom === 'id') return '22'
    if (nom === 'slotId') return 'creneau-1'
    if (nom === 'assignmentId') return 'affectation-1'
    if (nom === 'editionOrganizerId') return '7'
    return undefined
  })
  prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'Europe/Paris' })
  planningPublie(true)
  affectes({ benevoles: [], organisateurs: [] })
})

describe('déplacer un créneau publié', () => {
  beforeEach(() => {
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(CRENEAU)
    prismaMock.event.findUnique.mockResolvedValue({
      startDate: new Date('2026-07-30T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
      volunteerSettings: null,
    })
    prismaMock.volunteerTimeSlot.update.mockResolvedValue({
      ...CRENEAU,
      startDateTime: new Date('2026-08-01T18:00:00Z'),
      endDateTime: new Date('2026-08-01T22:00:00Z'),
      team: null,
      assignments: [],
      organizerAssignments: [],
      _count: { assignments: 0 },
    })
    global.readValidatedBody = vi.fn(async (_e: any, valider: any) =>
      valider({
        startDateTime: '2026-08-01T18:00:00.000Z',
        endDateTime: '2026-08-01T22:00:00.000Z',
      })
    )
  })

  it('⚠️ PRÉVIENT LES BÉNÉVOLES *ET* LES ORGANISATEURS affectés', async () => {
    /*
     * Les deux, et c'est le point : un organisateur posé sur un créneau tient le poste, il n'est
     * pas un spectateur. Son compte passe par `EditionOrganizer.organizerId` — s'il était lu sur
     * un `userId` inexistant, la notification partirait vers `undefined` sans lever.
     */
    affectes({ benevoles: [5], organisateurs: [9] })

    await modifier(evenement)

    expect(mockNotify).toHaveBeenCalledTimes(2)
    expect(mockNotify.mock.calls.map((c) => c[0].userId).sort()).toEqual([5, 9])
    // La relation demandée, et non seulement le résultat : voir la note du cas « organisateur ».
    const demande = prismaMock.organizerSlotAssignment.findMany.mock.calls[0][0]
    expect(demande.select).toEqual({
      editionOrganizer: { select: { organizer: { select: { userId: true } } } },
    })
    expect(mockNotify.mock.calls[0][0].notificationType).toBe('volunteer_slot_changed')
  })

  it('annonce l’ANCIEN et le NOUVEL horaire', async () => {
    // Sans l'ancien, la personne ne sait pas lequel de ses créneaux a bougé — elle en tient
    // souvent plusieurs — et doit rouvrir le planning pour le deviner.
    affectes({ benevoles: [5] })

    await modifier(evenement)

    const message = mockNotify.mock.calls[0][0].messageText
    expect(message).toContain('12:00') // fin d'avant, à l'heure de Paris
    expect(message).toContain('Maintenant')
  })

  it('⚠️ NE PRÉVIENT PERSONNE quand le planning n’est pas publié', async () => {
    /*
     * Avant publication, le planning est un brouillon qu'on réorganise beaucoup : notifier chaque
     * essai noierait les vraies annonces, et l'on cesserait de les lire.
     */
    planningPublie(false)
    affectes({ benevoles: [5] })

    await modifier(evenement)

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('⚠️ NE PRÉVIENT PERSONNE quand rien de notable n’a changé', async () => {
    /*
     * LE TÉMOIN NÉGATIF du lot. Renommer un créneau passe par le même PUT : si la règle regardait
     * l'objet `Date` plutôt que l'instant, ou ne regardait rien, un message partirait à chaque
     * enregistrement. Ici le corps ne change que le titre, et la réponse rend les MÊMES instants
     * dans de NOUVEAUX objets `Date` — exactement ce que fait la base.
     */
    global.readValidatedBody = vi.fn(async (_e: any, valider: any) => valider({ title: 'Bar' }))
    prismaMock.volunteerTimeSlot.update.mockResolvedValue({
      ...CRENEAU,
      startDateTime: new Date('2026-08-01T10:00:00Z'),
      endDateTime: new Date('2026-08-01T12:00:00Z'),
      team: null,
      assignments: [],
      organizerAssignments: [],
      _count: { assignments: 0 },
    })
    affectes({ benevoles: [5] })

    await modifier(evenement)

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('une notification impossible ne fait pas échouer le déplacement', async () => {
    // L'écriture est faite : répondre 500 ferait croire qu'elle ne l'est pas, et l'on recommencerait.
    affectes({ benevoles: [5] })
    prismaMock.edition.findUnique.mockRejectedValue(new Error('base indisponible'))

    const reponse: any = await modifier(evenement)

    expect(reponse.success).toBe(true)
    expect(prismaMock.volunteerTimeSlot.update).toHaveBeenCalled()
  })
})

describe('supprimer un créneau publié', () => {
  beforeEach(() => {
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(CRENEAU)
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, CRENEAU])
  })

  it('⚠️ LIT LES DESTINATAIRES AVANT LA TRANSACTION QUI LES EFFACE', async () => {
    /*
     * L'ASSERTION QUI PORTE LE LOT, et la seule qui pouvait attraper le défaut. La transaction
     * supprime les affectations, et la suppression du créneau emporte en cascade celles des
     * organisateurs. Lire après rendrait une liste VIDE : on ne préviendrait personne, tout en
     * AYANT L'AIR corrigé — rien n'échoue, et la réponse est la même.
     *
     * On mesure donc l'ORDRE des appels, pas leur présence.
     */
    affectes({ benevoles: [5] })

    await supprimerCreneau(evenement)

    const lecture = prismaMock.volunteerAssignment.findMany.mock.invocationCallOrder[0]
    const transaction = prismaMock.$transaction.mock.invocationCallOrder[0]
    expect(lecture).toBeLessThan(transaction)
    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify.mock.calls[0][0].notificationType).toBe('volunteer_slot_removed')
  })

  it('n’annonce rien quand le planning n’est pas publié', async () => {
    planningPublie(false)
    affectes({ benevoles: [5] })

    await supprimerCreneau(evenement)

    expect(mockNotify).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })
})

describe('retirer une personne d’un créneau', () => {
  it('prévient le bénévole retiré, et lui seul', async () => {
    prismaMock.volunteerAssignment.findFirst.mockResolvedValue({
      id: 'affectation-1',
      userId: 5,
      user: { id: 5, pseudo: 'jongleur' },
      timeSlot: CRENEAU,
    })
    prismaMock.volunteerAssignment.delete.mockResolvedValue({})

    await retirerBenevole(evenement)

    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify.mock.calls[0][0]).toMatchObject({
      userId: 5,
      notificationType: 'volunteer_slot_unassigned',
    })
  })

  it('⚠️ prévient l’ORGANISATEUR retiré sur son VRAI compte (`organizer.userId`)', async () => {
    /*
     * LE PIÈGE DE CE POINT D'API : `EditionOrganizer` ne porte PAS de `userId`. Lire ce champ
     * rendrait `undefined`, et la notification partirait vers un destinataire inexistant sans
     * qu'aucune erreur ne le dise. Le test fixe donc des valeurs DISTINCTES pour l'identifiant de
     * la ligne (7) et celui du compte (9) : avec un seul nombre, les deux lectures seraient
     * indiscernables.
     */
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(CRENEAU)
    // `7` = la ligne EditionOrganizer (paramètre d'URL), `11` = ConventionOrganizer, `9` = le
    // COMPTE. Trois nombres distincts : avec un seul, les trois lectures seraient indiscernables.
    prismaMock.editionOrganizer.findUnique.mockResolvedValue({
      id: 7,
      organizerId: 11,
      organizer: { userId: 9 },
    })
    prismaMock.organizerSlotAssignment.deleteMany.mockResolvedValue({ count: 1 })

    await retirerOrganisateur(evenement)

    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify.mock.calls[0][0].userId).toBe(9)
    /*
     * ⚠️ ET LA FORME DU `select`, parce que le bouchon central l'IGNORE : il rend ce qu'on lui a
     * dit quoi qu'on demande. Sans cette assertion, revenir à `select: { organizerId: true }`
     * laisserait ce cas VERT — le mock fournirait encore `organizer.userId` — alors qu'en
     * production Prisma ne renverrait pas la relation et l'on notifierait `undefined`.
     */
    const demande = prismaMock.editionOrganizer.findUnique.mock.calls[0][0]
    expect(demande.select).toEqual({ organizer: { select: { userId: true } } })
  })

  it('ne prévient personne quand l’affectation d’organisateur n’existait pas', async () => {
    // Le 404 précède l'envoi : annoncer un retrait qui n'a pas eu lieu serait pire que le silence.
    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue(CRENEAU)
    prismaMock.editionOrganizer.findUnique.mockResolvedValue({ organizerId: 9 })
    prismaMock.organizerSlotAssignment.deleteMany.mockResolvedValue({ count: 0 })

    await expect(retirerOrganisateur(evenement)).rejects.toBeTruthy()
    expect(mockNotify).not.toHaveBeenCalled()
  })
})
