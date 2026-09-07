import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockCanManage } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/organizers.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 1 } } }

/** `equipesDirigees` : parmi ses équipes, celles dont il est responsable. */
const ligne = (id: number, pseudo: string, teamIds: string[], equipesDirigees: string[] = []) => ({
  id,
  teamAssignments: teamIds.map((teamId) => ({
    teamId,
    isLeader: equipesDirigees.includes(teamId),
  })),
  organizer: { user: { id: id * 10, pseudo } },
})

describe('GET /api/editions/[id]/volunteers/organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      ligne(7, 'orga', ['accueil', 'bar'], ['bar']),
      ligne(8, 'autre', []),
    ])
  })

  it('rend les organisateurs avec leurs équipes', async () => {
    const res = await handler(evenement as any)

    expect(res.data.organizers).toEqual([
      {
        editionOrganizerId: 7,
        user: { id: 70, pseudo: 'orga' },
        teamIds: ['accueil', 'bar'],
        leaderTeamIds: ['bar'],
      },
      { editionOrganizerId: 8, user: { id: 80, pseudo: 'autre' }, teamIds: [], leaderTeamIds: [] },
    ])
  })

  it("rend aussi ceux qui n'ont aucune équipe", async () => {
    // Ils sont candidats à un créneau même sans rattachement : la liste ne doit pas les écarter.
    const res = await handler(evenement as any)

    expect(res.data.organizers.map((o: any) => o.editionOrganizerId)).toContain(8)
  })

  it("ne lit que les organisateurs de l'édition demandée", async () => {
    await handler(evenement as any)

    expect(prismaMock.editionOrganizer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editionId: 22 } })
    )
  })

  /**
   * La raison d'être de cet endpoint : le responsable du bénévolat n'a ni le droit sur les
   * organisateurs ni celui sur la billetterie, les deux qu'exige `/organizers/edition-organizers`.
   * C'est donc la permission du bénévolat qui commande ici, et elle seule.
   */
  it('refuse un contributeur sans droit sur les bénévoles', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.editionOrganizer.findMany).not.toHaveBeenCalled()
  })

  it('distingue les équipes dirigées de celles où il ne fait que figurer', async () => {
    // L'étoile de responsable se pose par équipe : confondre les deux listes la ferait
    // apparaître sur toutes celles de la personne.
    const res = await handler(evenement as any)
    const orga = res.data.organizers[0]

    expect(orga.teamIds).toContain('accueil')
    expect(orga.leaderTeamIds).not.toContain('accueil')
    expect(orga.leaderTeamIds).toEqual(['bar'])
  })
})
