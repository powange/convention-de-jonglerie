import { describe, it, expect, beforeEach, vi } from 'vitest'

// Auto-imports Nitro que le handler emploie sans les importer.
vi.hoisted(() => {
  const g = globalThis as any
  g.createSuccessResponse ??= (data: unknown) => ({ success: true, data })
})

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

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/team-organizers.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 1 } } }

const ligne = (teamId: string, id: number, pseudo: string) => ({
  teamId,
  editionOrganizer: { id, organizer: { user: { id: id * 10, pseudo } } },
})

describe('GET /api/editions/[id]/volunteers/team-organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([
      ligne('accueil', 7, 'orga'),
      ligne('bar', 8, 'autre'),
    ])
  })

  it('rend les rattachements avec leur équipe et leur utilisateur', async () => {
    const res = await handler(evenement as any)

    expect(res.data.assignments).toEqual([
      { teamId: 'accueil', editionOrganizerId: 7, user: { id: 70, pseudo: 'orga' } },
      { teamId: 'bar', editionOrganizerId: 8, user: { id: 80, pseudo: 'autre' } },
    ])
  })

  it("ne lit que les équipes de l'édition demandée", async () => {
    // Sans ce filtre, la répartition d'une édition afficherait les organisateurs d'une autre.
    await handler(evenement as any)

    expect(prismaMock.organizerTeamAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { team: { eventId: 22 } } })
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
    expect(prismaMock.organizerTeamAssignment.findMany).not.toHaveBeenCalled()
  })
})
