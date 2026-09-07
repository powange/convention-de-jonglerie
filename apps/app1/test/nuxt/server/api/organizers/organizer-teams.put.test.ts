import { describe, it, expect, beforeEach, vi } from 'vitest'

// Ces fonctions sont des auto-imports Nitro : le handler les emploie sans les importer, et
// rien ne les fournit ici. On les pose avant le chargement du handler (vi.hoisted s'exécute
// avant les imports).
vi.hoisted(() => {
  const g = globalThis as any
  g.wrapApiHandler ??= (handler: any) => handler
  g.validateEditionId ??= (event: any) => parseInt(event?.context?.params?.id, 10)
  g.validateResourceId ??= (event: any, nom: string) => parseInt(event?.context?.params?.[nom], 10)
  g.createSuccessResponse ??= (data: unknown) => ({ success: true, data })
})

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: mockCanManage,
}))

import handler from '../../../../../server/api/editions/[id]/organizers/edition-organizers/[editionOrganizerId]/teams.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', editionOrganizerId: '7' }, user: { id: 1, pseudo: 'orga' } },
}

/** Lignes transmises au createMany des rattachements */
const lignesEcrites = () =>
  prismaMock.organizerTeamAssignment.createMany.mock.calls[0]?.[0]?.data ?? []

describe('PUT /api/editions/[id]/organizers/edition-organizers/[id]/teams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: true })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 7 })
    // Par défaut, toutes les équipes demandées appartiennent à l'édition
    prismaMock.volunteerTeam.count.mockImplementation(async ({ where }: any) => where.id.in.length)
    prismaMock.organizerTeamAssignment.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.organizerTeamAssignment.createMany.mockResolvedValue({ count: 2 })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
  })

  const envoyer = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  it('rattache l’organisateur aux équipes demandées', async () => {
    const result = await envoyer({ teamIds: ['equipe-accueil', 'equipe-bar'] })

    expect(result.success).toBe(true)
    expect(lignesEcrites()).toEqual([
      { editionOrganizerId: 7, teamId: 'equipe-accueil' },
      { editionOrganizerId: 7, teamId: 'equipe-bar' },
    ])
  })

  it('remplace les rattachements existants', async () => {
    await envoyer({ teamIds: ['equipe-accueil'] })

    expect(prismaMock.organizerTeamAssignment.deleteMany).toHaveBeenCalledWith({
      where: { editionOrganizerId: 7 },
    })
  })

  it('vide les rattachements sans rien réécrire quand la liste est vide', async () => {
    await envoyer({ teamIds: [] })

    expect(prismaMock.organizerTeamAssignment.deleteMany).toHaveBeenCalled()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
  })

  it("refuse une équipe étrangère à l'édition", async () => {
    prismaMock.volunteerTeam.count.mockResolvedValue(1) // une seule des deux existe

    await expect(envoyer({ teamIds: ['equipe-accueil', 'equipe-ailleurs'] })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
  })

  it('refuse un organisateur absent de cette édition', async () => {
    // Sans ce contrôle, l'identifiant d'un organisateur d'une autre édition passerait la
    // permission de celle-ci et se retrouverait dans ses équipes.
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

    await expect(envoyer({ teamIds: ['equipe-accueil'] })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
  })

  it("refuse quand l'édition n'a pas ouvert l'option", async () => {
    // Le droit sur les bénévoles ne suffit pas : l'édition doit avoir ouvert le rattachement.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ organizersInTeams: false })

    await expect(envoyer({ teamIds: ['equipe-accueil'] })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
    expect(prismaMock.organizerTeamAssignment.deleteMany).not.toHaveBeenCalled()
  })

  it("refuse quand l'édition n'a aucun réglage bénévole", async () => {
    // Sans ligne de réglages, il n'y a pas d'option ouverte : le défaut est fermé, pas absent.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(null)

    await expect(envoyer({ teamIds: ['equipe-accueil'] })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
  })

  it('refuse un contributeur sans droit sur les bénévoles', async () => {
    // C'est la permission du bénévolat qui compte : ce qu'on modifie est la composition
    // d'une équipe de bénévoles, pas la fiche de l'organisateur.
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer({ teamIds: ['equipe-accueil'] })).rejects.toBeDefined()
    expect(prismaMock.organizerTeamAssignment.createMany).not.toHaveBeenCalled()
  })
})
