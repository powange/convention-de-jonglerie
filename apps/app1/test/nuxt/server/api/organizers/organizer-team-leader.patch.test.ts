import { describe, it, expect, beforeEach, vi } from 'vitest'

// Auto-imports Nitro que le handler emploie sans les importer.
vi.hoisted(() => {
  const g = globalThis as any
  g.wrapApiHandler ??= (handler: any) => handler
  g.validateEditionId ??= (event: any) => parseInt(event?.context?.params?.id, 10)
  g.validateResourceId ??= (event: any, nom: string) => parseInt(event?.context?.params?.[nom], 10)
  g.validateStringId ??= (event: any, nom: string) => event?.context?.params?.[nom]
  g.createSuccessResponse ??= (data: unknown) => ({ success: true, data })
})

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: mockCanManage,
}))

import handler from '../../../../../server/api/editions/[id]/organizers/edition-organizers/[editionOrganizerId]/teams/[teamId]/leader.patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: {
    params: { id: '22', editionOrganizerId: '7', teamId: 'equipe-accueil' },
    user: { id: 1 },
  },
}

/**
 * Nommer un organisateur responsable ne pose pas qu'une étiquette : le statut tient lieu du
 * droit « gestion des bénévoles » sur le périmètre de l'équipe. Les gardes comptent donc autant
 * que l'écriture elle-même.
 */
describe('PATCH …/organizers/edition-organizers/[id]/teams/[teamId]/leader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: true })
    prismaMock.organizerTeamAssignment.findFirst.mockResolvedValue({ teamId: 'equipe-accueil' })
    prismaMock.organizerTeamAssignment.update.mockResolvedValue({})
  })

  const envoyer = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  it('nomme un organisateur responsable de son équipe', async () => {
    const res = await envoyer({ isLeader: true })

    expect(res.success).toBe(true)
    expect(prismaMock.organizerTeamAssignment.update).toHaveBeenCalledWith({
      where: { editionOrganizerId_teamId: { editionOrganizerId: 7, teamId: 'equipe-accueil' } },
      data: { isLeader: true },
    })
  })

  it('le destitue', async () => {
    await envoyer({ isLeader: false })

    expect(prismaMock.organizerTeamAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isLeader: false } })
    )
  })

  it("refuse quand l'organisateur n'est pas rattaché à l'équipe", async () => {
    // On ne dirige pas une équipe dont on ne fait pas partie.
    prismaMock.organizerTeamAssignment.findFirst.mockResolvedValue(null)

    await expect(envoyer({ isLeader: true })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.update).not.toHaveBeenCalled()
  })

  it("cloisonne le rattachement à l'édition demandée", async () => {
    // Sans ce filtre, un identifiant emprunté à une édition voisine passerait la permission
    // de celle-ci.
    await envoyer({ isLeader: true })

    expect(prismaMock.organizerTeamAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionOrganizer: { editionId: 22 },
          team: { eventId: 22 },
        }),
      })
    )
  })

  it("refuse quand l'édition n'a pas ouvert l'option", async () => {
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: false })

    await expect(envoyer({ isLeader: true })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.update).not.toHaveBeenCalled()
  })

  /**
   * Le droit complet est exigé, et non le statut de responsable : sans quoi un responsable
   * pourrait s'adjoindre qui il veut, et l'accès aux bénévoles se propagerait de proche en
   * proche sans qu'aucun gestionnaire n'en décide.
   */
  it('refuse un contributeur sans droit sur les bénévoles', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer({ isLeader: true })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.update).not.toHaveBeenCalled()
  })
})
