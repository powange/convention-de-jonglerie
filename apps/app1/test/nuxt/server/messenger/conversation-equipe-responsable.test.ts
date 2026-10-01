import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEquipesDontIlEstResponsable = vi.hoisted(() => vi.fn())
const mockAssurerConversations = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/editions/volunteers/responsables-equipe', () => ({
  equipesDontIlEstResponsable: mockEquipesDontIlEstResponsable,
}))

vi.mock('#server/utils/messenger-helpers', () => ({
  assurerConversationsEquipeDesMembres: mockAssurerConversations,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../server/api/messenger/team-conversation.post'

const prismaMock = (globalThis as any).prisma

/**
 * Le bouton « écrire à l'équipe », pour un responsable qui n'est pas bénévole.
 *
 * ⚠️ SIGNALÉ PAR L'UTILISATEUR : les responsables d'équipe n'avaient, sur leur page bénévole
 * publique, « ni le détail de leurs équipes ni le bouton qui permet d'envoyer un message dans la
 * messagerie privée groupée de leur équipe ».
 *
 * ⚠️⚠️ ET LA GARDE ÉTAIT L'ANGLE MORT QUE LE DÉPÔT S'ÉTAIT DÉJÀ INTERDIT. Elle interrogeait
 * `applicationTeamAssignment` EN DIRECT, c'est-à-dire les seules candidatures de bénévoles. Un
 * responsable qui tient ce rôle comme ORGANISATEUR n'a pas de candidature : 403. Or
 * `responsables-equipe.ts` dit mot pour mot qu'interroger cette table seule « rouvrirait l'angle
 * mort sans que rien ne le signale » — c'est exactement ce qui s'était produit ici.
 *
 * 📍 LE SECOND CAS CI-DESSOUS N'EST PAS UNE FORMALITÉ : jusqu'ici le demandeur figurait forcément
 * parmi les membres acceptés, et son ajout explicite à la conversation n'était qu'une ceinture. Un
 * responsable organisateur, lui, n'y figure pas : sans cet ajout il ouvrirait une conversation dont
 * il serait absent.
 */
describe('POST /api/messenger/team-conversation', () => {
  const EDITION = 7
  const EQUIPE = 'equipe-securite'

  const evenement = (userId: number) => ({ context: { user: { id: userId } } })

  const poster = (userId: number) => {
    global.readBody = vi.fn().mockResolvedValue({ editionId: EDITION, teamId: EQUIPE })
    return handler(evenement(userId) as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEquipesDontIlEstResponsable.mockResolvedValue([])
    mockAssurerConversations.mockResolvedValue(undefined)
    prismaMock.applicationTeamAssignment.findFirst.mockReset()
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)
    prismaMock.applicationTeamAssignment.findMany.mockReset()
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { application: { userId: 11 } },
      { application: { userId: 12 } },
    ])
    prismaMock.conversation.findFirst.mockReset()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv-1' })
  })

  it('🔬 autorise un responsable ORGANISATEUR, sans candidature de bénévole', async () => {
    // Aucune candidature acceptée — c'est tout le cas : avant le correctif, 403.
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)
    mockEquipesDontIlEstResponsable.mockResolvedValue([EQUIPE])

    const resultat = await poster(42)

    expect(resultat).toMatchObject({ data: { conversationId: 'conv-1' } })
  })

  it('🔬 ajoute ce responsable aux participants de la conversation', async () => {
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)
    mockEquipesDontIlEstResponsable.mockResolvedValue([EQUIPE])

    await poster(42)

    const [, , participants] = mockAssurerConversations.mock.calls[0]
    // Lui d'abord, puis les bénévoles acceptés de l'équipe : il n'est dans aucune des deux listes
    // que la base rend, donc son absence ici le laisserait hors de son propre fil.
    expect(participants).toContain(42)
    expect(participants).toEqual(expect.arrayContaining([11, 12]))
  })

  it('autorise toujours un bénévole accepté membre de l’équipe', async () => {
    // Non-régression : le cas d'avant le correctif doit continuer de passer, y compris quand la
    // personne ne dirige aucune équipe.
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({ id: 'affectation' })
    mockEquipesDontIlEstResponsable.mockResolvedValue([])

    await expect(poster(11)).resolves.toMatchObject({ data: { conversationId: 'conv-1' } })
  })

  it('refuse qui n’est ni membre ni responsable de cette équipe', async () => {
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)
    // Responsable d'une AUTRE équipe : la garde doit rester fermée sur celle-ci.
    mockEquipesDontIlEstResponsable.mockResolvedValue(['une-autre-equipe'])

    await expect(poster(99)).rejects.toThrow("Vous n'êtes pas membre de cette équipe")
    expect(mockAssurerConversations).not.toHaveBeenCalled()
  })
})
