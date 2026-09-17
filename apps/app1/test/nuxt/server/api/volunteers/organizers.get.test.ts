import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

const mockPeutGerer = vi.hoisted(() => vi.fn())
vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockPeutGerer } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/organizers.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 42 } } }

/**
 * Le contrat de `/volunteers/organizers`, et pourquoi il mérite un test.
 *
 * TROIS écrans le lisent : la répartition par équipe, l'affectation d'un organisateur à un
 * créneau, et le rattachement aux équipes. Aucun ne le testait — et la réponse a été remplacée
 * par un tableau nu lors d'un lot qui croyait créer ce point d'API alors qu'il l'écrasait.
 *
 * Rien ne l'a signalé : la CI était verte, le typage muet, et le symptôme — une liste
 * d'organisateurs vide au moment d'en affecter un — ne se voyait qu'en ouvrant la modale.
 *
 * Ces tests tiennent donc la FORME, champ par champ, et non le comportement du mock.
 */
describe('GET /api/editions/[id]/volunteers/organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGerer.mockResolvedValue(true)
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('exige le droit de gérer les BÉNÉVOLES, et non celui des organisateurs', async () => {
    mockPeutGerer.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionOrganizer.findMany).not.toHaveBeenCalled()
  })

  it('rend `{ organizers: [...] }` et NON un tableau nu', async () => {
    // C'est exactement ce qui a été cassé : les écrans lisent `data.organizers`, et un tableau
    // nu leur donnait une liste vide sans la moindre erreur.
    const reponse = await handler(evenement as any)

    expect(Array.isArray(reponse)).toBe(false)
    expect(reponse.data).toHaveProperty('organizers')
    expect(Array.isArray(reponse.data.organizers)).toBe(true)
  })

  it('rend les quatre champs que les écrans consomment', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 7,
        teamAssignments: [
          { teamId: 'bar', isLeader: true },
          { teamId: 'accueil', isLeader: false },
        ],
        organizer: { user: { id: 1, pseudo: 'clairb', prenom: 'Claire', nom: 'Bernard' } },
      },
    ])

    const { organizers } = (await handler(evenement as any)).data

    expect(organizers[0]).toMatchObject({
      // `editionOrganizerId`, et non `id` : c'est ce nom-là que la modale d'affectation attend.
      editionOrganizerId: 7,
      teamIds: ['bar', 'accueil'],
      leaderTeamIds: ['bar'],
    })
    expect(organizers[0].user.pseudo).toBe('clairb')
  })

  it('rend des IDENTIFIANTS d’équipe, que l’écran rapproche du catalogue', async () => {
    // La tentation est de rendre les équipes nommées. Ce point d'API ne le fait pas, et trois
    // écrans en dépendent : changer cela sans les changer tous les casserait en silence.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 7,
        teamAssignments: [{ teamId: 'bar', isLeader: false }],
        organizer: { user: { id: 1, pseudo: 'x', prenom: null, nom: null } },
      },
    ])

    const { organizers } = (await handler(evenement as any)).data

    expect(organizers[0].teamIds).toEqual(['bar'])
    expect(organizers[0]).not.toHaveProperty('teams')
  })

  it('demande un ordre stable à la base', async () => {
    // Sans tri, l'affichage change d'une requête à l'autre. C'est la REQUÊTE qu'on tient : un
    // mock rendrait de toute façon ce qu'on lui dit.
    await handler(evenement as any)

    const appel = prismaMock.editionOrganizer.findMany.mock.calls[0][0]
    expect(appel.where).toEqual({ editionId: 22 })
    expect(appel.orderBy).toBeDefined()
  })
})
