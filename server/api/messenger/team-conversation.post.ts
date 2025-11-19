import { ensureVolunteerConversations } from '@@/server/utils/messenger-helpers'

/**
 * POST /api/messenger/team-conversation
 * Crée ou récupère la conversation de groupe d'une équipe
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readBody(event)
  const { editionId, teamId } = body

  if (!editionId || !teamId) {
    throw createError({
      statusCode: 400,
      message: "L'ID de l'édition et l'ID de l'équipe sont requis",
    })
  }

  // Vérifier que l'utilisateur est bien membre de l'équipe
  const teamAssignment = await prisma.applicationTeamAssignment.findFirst({
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
    // Récupérer tous les bénévoles acceptés de cette équipe
    const allTeamMembers = await prisma.applicationTeamAssignment.findMany({
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
    const teamGroupConversation = await prisma.conversation.findFirst({
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
})
