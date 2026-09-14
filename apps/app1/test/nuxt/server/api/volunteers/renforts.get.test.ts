import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/organizer-management', () => ({
  canManageEditionVolunteers: vi.fn(async () => true),
}))

vi.mock('../../../../../server/utils/editions/volunteers/responsables-equipe', () => ({
  equipesDontIlEstResponsable: vi.fn(async () => []),
}))

import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import renforts from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/renforts.get'

const prismaMock = (globalThis as any).prisma
const mockPeutGerer = canManageEditionVolunteers as ReturnType<typeof vi.fn>
const mockEquipesResponsable = equipesDontIlEstResponsable as ReturnType<typeof vi.fn>

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

const volante = { id: 'e1', name: 'Volants', color: '#000', isFloatingTeam: true }
const cuisine = { id: 'e2', name: 'Cuisine', color: '#fff', isFloatingTeam: false }

/** Une candidature telle que Prisma la rend. */
const candidature = (id: number, userId: number, equipes: unknown[], entree = true) => ({
  id,
  userId,
  entryValidated: entree,
  userSnapshotPhone: null,
  user: { id: userId, pseudo: `personne-${userId}`, phone: '0600000000' },
  teamAssignments: equipes.map((team) => ({ team })),
})

describe('les renforts disponibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGerer.mockResolvedValue(true)
    mockEquipesResponsable.mockResolvedValue([])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
  })

  it('ne garde que ceux dont TOUTES les équipes sont volantes', async () => {
    // Un bénévole à la fois en cuisine et volant n'est pas un renfort : il a ses heures à faire.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      candidature(1, 11, [volante]),
      candidature(2, 12, [volante, cuisine]),
    ])

    const reponse: any = await renforts(evenement as any)

    expect(reponse.data.renforts.map((r: any) => r.id)).toEqual([1])
  })

  it('demande bien le pseudo au sélecteur', async () => {
    // ⚠️ Le défaut constaté en vrai : le select ne contenait que `phone`, et l'écran affichait des
    // personnes sans nom — celui de leur équipe se lisait à la place. Un mock rend ce qu'on lui
    // dit, donc seule une assertion sur la REQUÊTE peut l'attraper.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

    await renforts(evenement as any)

    const select = prismaMock.editionVolunteerApplication.findMany.mock.calls.at(-1)![0].select
    // Nom et prénom compris : cet écran s'adresse aux responsables, qui appellent les gens par
    // leur nom et non par leur pseudo.
    expect(select.user.select).toMatchObject({
      pseudo: true,
      nom: true,
      prenom: true,
      phone: true,
    })
  })

  it('rend les créneaux de chacun, et à personne d’autre', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      candidature(1, 11, [volante]),
      candidature(2, 12, [volante]),
    ])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      {
        userId: 11,
        timeSlot: {
          id: 's1',
          title: 'Renfort bar',
          startDateTime: new Date('2026-08-01T17:00:00Z'),
          endDateTime: new Date('2026-08-01T20:00:00Z'),
          team: cuisine,
        },
      },
    ])

    const reponse: any = await renforts(evenement as any)

    const premier = reponse.data.renforts.find((r: any) => r.id === 1)
    const second = reponse.data.renforts.find((r: any) => r.id === 2)
    expect(premier.creneaux).toHaveLength(1)
    expect(premier.creneaux[0].equipe.name).toBe('Cuisine')
    expect(second.creneaux).toEqual([])
  })

  it('rend l’entrée validée telle quelle, sans en déduire un état', async () => {
    // L'état se calcule à l'écran, avec l'heure du navigateur : l'API rend les faits.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      candidature(1, 11, [volante], false),
    ])

    const reponse: any = await renforts(evenement as any)

    expect(reponse.data.renforts[0].entreeValidee).toBe(false)
    expect(reponse.data.renforts[0]).not.toHaveProperty('etat')
  })

  it('n’interroge pas les créneaux quand aucun volant ne ressort', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

    await renforts(evenement as any)

    expect(prismaMock.volunteerAssignment.findMany).not.toHaveBeenCalled()
  })

  it('refuse qui ne gère ni ne dirige aucune équipe', async () => {
    mockPeutGerer.mockResolvedValue(false)
    mockEquipesResponsable.mockResolvedValue([])

    await expect(renforts(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('accepte un responsable d’équipe', async () => {
    // C'est lui qui cherche du renfort quand son équipe déborde.
    mockPeutGerer.mockResolvedValue(false)
    mockEquipesResponsable.mockResolvedValue(['e2'])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

    await expect(renforts(evenement as any)).resolves.toBeDefined()
  })
})
