import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ensureVolunteerConversations } from '@@/server/utils/messenger-helpers'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock de ensureVolunteerConversations
vi.mock('../../../../../server/utils/messenger-helpers', () => ({
  ensureVolunteerConversations: vi.fn(),
}))

const mockEnsureVolunteerConversations = vi.mocked(ensureVolunteerConversations)

// Mock global de readBody
global.readBody = vi.fn()

// Créer un handler simplifié pour les tests
const mockHandler = async (event: any) => {
  const user = event.context.user

  if (!user) {
    const error = new Error('Non authentifié')
    ;(error as any).statusCode = 401
    throw error
  }

  const body = await readBody(event)
  const { editionId, teamId } = body

  if (!editionId || !teamId) {
    throw createError({
      statusCode: 400,
      message: "L'ID de l'édition et l'ID de l'équipe sont requis",
    })
  }

  // Vérifier que l'utilisateur est bien membre de l'équipe
  const teamAssignment = await prismaMock.applicationTeamAssignment.findFirst({
    where: {
      teamId,
      application: {
        editionId,
        userId: user.id,
        status: 'ACCEPTED',
      },
    },
  })

  if (!teamAssignment) {
    throw createError({
      statusCode: 403,
      message: "Vous n'êtes pas membre de cette équipe",
    })
  }

  try {
    // Créer ou récupérer les conversations de l'équipe pour l'utilisateur actuel
    await ensureVolunteerConversations(editionId, teamId, user.id)

    // Synchroniser tous les membres de l'équipe dans la conversation
    const allTeamMembers = await prismaMock.applicationTeamAssignment.findMany({
      where: {
        teamId,
        application: {
          editionId,
          status: 'ACCEPTED',
        },
      },
      select: {
        application: {
          select: { userId: true },
        },
      },
    })

    // S'assurer que tous les membres sont dans la conversation
    for (const member of allTeamMembers) {
      await ensureVolunteerConversations(editionId, teamId, member.application.userId)
    }

    // Récupérer la conversation de groupe de l'équipe
    const teamGroupConversation = await prismaMock.conversation.findFirst({
      where: {
        editionId,
        teamId,
        type: 'TEAM_GROUP',
      },
      select: {
        id: true,
      },
    })

    if (!teamGroupConversation) {
      throw createError({
        statusCode: 404,
        message: "La conversation de l'équipe n'a pas pu être créée",
      })
    }

    return {
      conversationId: teamGroupConversation.id,
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la conversation:', error)
    throw createError({
      statusCode: 500,
      message: error.message || "Erreur lors de la création de la conversation de l'équipe",
    })
  }
}

describe('/api/messenger/team-conversation POST', () => {
  const baseEvent = {
    context: {
      user: { id: 10 },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureVolunteerConversations.mockReset()
  })

  it('crée/récupère la conversation et synchronise tous les membres', async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    // L'utilisateur est membre de l'équipe
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
      teamId: 'team1',
      applicationId: 1,
      isTeamLeader: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    // Tous les membres de l'équipe
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      {
        application: { userId: 10 },
      },
      {
        application: { userId: 11 },
      },
      {
        application: { userId: 12 },
      },
    ] as any)

    // La conversation existe
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv123',
    } as any)

    mockEnsureVolunteerConversations.mockResolvedValue(undefined)

    const res = await mockHandler(baseEvent as any)

    expect(res).toEqual({
      conversationId: 'conv123',
    })

    // Vérifie que ensureVolunteerConversations a été appelé pour tous les membres
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledTimes(4) // 1 + 3 membres
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledWith(1, 'team1', 10)
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledWith(1, 'team1', 11)
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledWith(1, 'team1', 12)

    // Vérifie que la conversation a été récupérée
    expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        editionId: 1,
        teamId: 'team1',
        type: 'TEAM_GROUP',
      },
      select: {
        id: true,
      },
    })
  })

  it('rejette si editionId manquant', async () => {
    vi.mocked(readBody).mockResolvedValue({
      teamId: 'team1',
    })

    await expect(mockHandler(baseEvent as any)).rejects.toThrow(
      "L'ID de l'édition et l'ID de l'équipe sont requis"
    )
  })

  it('rejette si teamId manquant', async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
    })

    await expect(mockHandler(baseEvent as any)).rejects.toThrow(
      "L'ID de l'édition et l'ID de l'équipe sont requis"
    )
  })

  it("rejette si l'utilisateur n'est pas membre de l'équipe", async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)

    await expect(mockHandler(baseEvent as any)).rejects.toThrow(
      "Vous n'êtes pas membre de cette équipe"
    )
  })

  it("rejette si l'utilisateur n'est pas un bénévole accepté", async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    // Trouve l'assignment mais l'application n'est pas ACCEPTED (la condition where ne match pas)
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)

    await expect(mockHandler(baseEvent as any)).rejects.toThrow(
      "Vous n'êtes pas membre de cette équipe"
    )

    // Vérifie que la requête inclut bien le filtre status: 'ACCEPTED'
    expect(prismaMock.applicationTeamAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        teamId: 'team1',
        application: {
          editionId: 1,
          userId: 10,
          status: 'ACCEPTED',
        },
      },
    })
  })

  it("rejette si la conversation n'a pas pu être créée", async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
    } as any)

    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      {
        application: { userId: 10 },
      },
    ] as any)

    // La conversation n'existe pas après la création
    prismaMock.conversation.findFirst.mockResolvedValue(null)

    mockEnsureVolunteerConversations.mockResolvedValue(undefined)

    await expect(mockHandler(baseEvent as any)).rejects.toThrow(
      "La conversation de l'équipe n'a pas pu être créée"
    )
  })

  it('synchronise uniquement les membres avec status ACCEPTED', async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
    } as any)

    // Seulement les membres ACCEPTED sont récupérés
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      {
        application: { userId: 10 },
      },
      {
        application: { userId: 11 },
      },
    ] as any)

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv123',
    } as any)

    mockEnsureVolunteerConversations.mockResolvedValue(undefined)

    await mockHandler(baseEvent as any)

    // Vérifie que findMany a été appelé avec le filtre ACCEPTED
    expect(prismaMock.applicationTeamAssignment.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team1',
        application: {
          editionId: 1,
          status: 'ACCEPTED',
        },
      },
      select: {
        application: {
          select: { userId: true },
        },
      },
    })

    // Vérifie que seuls les 2 membres ACCEPTED + l'utilisateur actuel sont synchronisés
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledTimes(3) // 1 + 2 membres
  })

  it('gère les erreurs lors de la synchronisation', async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
    } as any)

    mockEnsureVolunteerConversations.mockRejectedValue(new Error('Erreur de synchronisation'))

    await expect(mockHandler(baseEvent as any)).rejects.toThrow('Erreur de synchronisation')
  })

  it('retourne la conversation même si un seul membre', async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
    } as any)

    // Un seul membre dans l'équipe (l'utilisateur actuel)
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      {
        application: { userId: 10 },
      },
    ] as any)

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv123',
    } as any)

    mockEnsureVolunteerConversations.mockResolvedValue(undefined)

    const res = await mockHandler(baseEvent as any)

    expect(res).toEqual({
      conversationId: 'conv123',
    })

    // Vérifie que ensureVolunteerConversations a été appelé 2 fois (1 initial + 1 dans la boucle)
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledTimes(2)
  })

  it("fonctionne pour un chef d'équipe", async () => {
    vi.mocked(readBody).mockResolvedValue({
      editionId: 1,
      teamId: 'team1',
    })

    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({
      id: 'assign1',
      isTeamLeader: true,
    } as any)

    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      {
        application: { userId: 10 },
      },
      {
        application: { userId: 11 },
      },
    ] as any)

    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv123',
    } as any)

    mockEnsureVolunteerConversations.mockResolvedValue(undefined)

    const res = await mockHandler(baseEvent as any)

    expect(res).toEqual({
      conversationId: 'conv123',
    })

    // Les chefs d'équipe ont les mêmes permissions que les membres normaux pour cette action
    expect(mockEnsureVolunteerConversations).toHaveBeenCalledTimes(3) // 1 + 2 membres
  })
})
