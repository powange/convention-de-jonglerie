import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockEnsureTeamConversation = vi.hoisted(() => vi.fn())
const mockRemoveFromTeamConversations = vi.hoisted(() => vi.fn())

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    messenger: {
      ensureTeamConversation: mockEnsureTeamConversation,
      removeFromTeamConversations: mockRemoveFromTeamConversations,
    },
  }),
}))

import { assignVolunteerToTeams } from '../../../../server/utils/editions/volunteers/teams'

const prismaMock = (globalThis as any).prisma

/** Les lignes transmises au `createMany` des rattachements. */
const lignesEcrites = () =>
  prismaMock.applicationTeamAssignment.createMany.mock.calls[0]?.[0]?.data ?? []

/**
 * Cette fonction remplace la liste des équipes d'un bénévole — elle ne destitue personne.
 *
 * L'écran de répartition enregistre désormais toute la liste d'un coup : sans cette précaution,
 * ajuster une équipe retirerait son rôle au responsable sur toutes les autres, sans qu'aucun
 * écran ne le dise. Le chemin organisateur tient déjà cette règle ; les deux s'accordent.
 */
describe('assignVolunteerToTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
      eventId: 22,
      userId: 42,
    })
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([])
    prismaMock.applicationTeamAssignment.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.applicationTeamAssignment.createMany.mockResolvedValue({ count: 0 })
  })

  it('conserve la responsabilité des équipes gardées', async () => {
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { teamId: 'accueil', isLeader: true },
      { teamId: 'cuisine', isLeader: false },
    ])

    await assignVolunteerToTeams(5, ['accueil', 'bar'])

    expect(lignesEcrites()).toEqual([
      { applicationId: 5, teamId: 'accueil', isLeader: true },
      { applicationId: 5, teamId: 'bar', isLeader: false },
    ])
  })

  it("n'invente pas de responsabilité sur une équipe rejointe", async () => {
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { teamId: 'accueil', isLeader: true },
    ])

    await assignVolunteerToTeams(5, ['bar'])

    expect(lignesEcrites()).toEqual([{ applicationId: 5, teamId: 'bar', isLeader: false }])
  })

  it('dédoublonne les équipes demandées', async () => {
    await assignVolunteerToTeams(5, ['accueil', 'accueil'])

    expect(lignesEcrites()).toEqual([{ applicationId: 5, teamId: 'accueil', isLeader: false }])
  })

  it('retire des conversations des équipes quittées', async () => {
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { teamId: 'cuisine', isLeader: false },
    ])

    await assignVolunteerToTeams(5, ['accueil'])

    expect(mockRemoveFromTeamConversations).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'cuisine', userId: 42 })
    )
  })

  it("n'écrit rien quand la liste est vide", async () => {
    await assignVolunteerToTeams(5, [])

    expect(prismaMock.applicationTeamAssignment.deleteMany).toHaveBeenCalled()
    expect(prismaMock.applicationTeamAssignment.createMany).not.toHaveBeenCalled()
  })
})
