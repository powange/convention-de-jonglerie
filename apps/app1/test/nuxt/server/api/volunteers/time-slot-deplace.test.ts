import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireManagement = vi.fn()

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { requireManagementAccess: mockRequireManagement } }),
}))

import { inclusionCreneau } from '../../../../../../../layers/volunteers/server/utils/creneau-formate'
import modifier from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/[slotId].put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', slotId: 'creneau-1' }, user: { id: 1 } },
}

const personne = {
  id: 5,
  pseudo: 'jongleur',
  nom: 'Dupont',
  prenom: 'Jean',
  pronouns: 'il/lui',
  email: 'jean@exemple.fr',
  emailHash: 'empreinte-5',
  profilePicture: 'jean.jpg',
  updatedAt: new Date('2026-01-02T03:04:05Z'),
}

/**
 * Déplacer un créneau ne doit rien effacer de ce qu'on voyait dessus.
 *
 * Le client ne recharge PAS la liste après un déplacement : il remplace en mémoire le créneau par
 * celui que ce point d'API renvoie. Une réponse incomplète efface donc à l'écran ce qu'elle a
 * laissé de côté, et tout revient au rechargement de la page — d'où un défaut qu'on croit
 * imaginaire quand on le signale.
 *
 * C'est arrivé : la réponse ne portait ni la photo des bénévoles, ni les organisateurs affectés,
 * ni le retard.
 */
describe('déplacer un créneau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((_e: any, nom: string) => (nom === 'id' ? '22' : 'creneau-1'))
    global.readValidatedBody = vi.fn(async (_e: any, valider: any) =>
      valider({
        startDateTime: '2026-08-01T18:00:00.000Z',
        endDateTime: '2026-08-01T22:00:00.000Z',
      })
    )

    prismaMock.volunteerTimeSlot.findFirst.mockResolvedValue({
      id: 'creneau-1',
      eventId: 22,
      startDateTime: new Date('2026-08-01T10:00:00Z'),
      endDateTime: new Date('2026-08-01T12:00:00Z'),
    })
    prismaMock.event.findUnique.mockResolvedValue({
      startDate: new Date('2026-07-30T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
      volunteerSettings: null,
    })
    prismaMock.volunteerTimeSlot.update.mockResolvedValue({
      id: 'creneau-1',
      title: 'Bar du soir',
      description: null,
      startDateTime: new Date('2026-08-01T18:00:00Z'),
      endDateTime: new Date('2026-08-01T22:00:00Z'),
      teamId: 'bar',
      maxVolunteers: 3,
      delayMinutes: 15,
      team: { id: 'bar', name: 'Bar', color: '#ff0000' },
      assignments: [{ id: 'a1', user: personne }],
      organizerAssignments: [
        { editionOrganizer: { id: 7, organizer: { user: { ...personne, id: 9 } } } },
      ],
      _count: { assignments: 1 },
    })
  })

  it('DEMANDE à la base de quoi réafficher les personnes du créneau', async () => {
    // L'assertion qui compte, et la seule qui pouvait attraper le défaut : un mock rend ce qu'on
    // lui dit, donc vérifier la réponse ne prouve rien sur ce que la requête a demandé. C'est
    // précisément ainsi que la réponse amputée est passée inaperçue.
    await modifier(evenement as any)

    const requete = prismaMock.volunteerTimeSlot.update.mock.calls[0][0]
    expect(requete.include).toBe(inclusionCreneau)
  })

  it('rend la photo des bénévoles affectés', async () => {
    const reponse: any = await modifier(evenement as any)

    expect(reponse.data.assignments[0].user).toMatchObject({
      profilePicture: 'jean.jpg',
      emailHash: 'empreinte-5',
    })
  })

  it('rend les organisateurs affectés', async () => {
    // Absents de l'ancienne réponse : ils disparaissaient de l'affichage ET du compteur de
    // places, qui les additionne aux bénévoles.
    const reponse: any = await modifier(evenement as any)

    expect(reponse.data.organizerAssignments).toEqual([
      { editionOrganizerId: 7, user: expect.objectContaining({ id: 9 }) },
    ])
  })

  it('rend le retard du créneau', async () => {
    const reponse: any = await modifier(evenement as any)

    expect(reponse.data.delayMinutes).toBe(15)
  })
})
