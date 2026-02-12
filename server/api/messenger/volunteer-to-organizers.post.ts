import { ensureVolunteerToOrganizersConversation } from '#server/utils/messenger-helpers'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readBody(event)
  const { editionId } = body

  if (!editionId) {
    throw createError({
      status: 400,
      message: "L'ID de l'édition est requis",
    })
  }

  // Vérifier que l'utilisateur est bien bénévole accepté de cette édition
  const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
    where: {
      editionId,
      userId: user.id,
      status: 'ACCEPTED',
    },
  })

  if (!volunteerApplication) {
    throw createError({
      status: 403,
      message: "Vous n'êtes pas bénévole de cette édition",
    })
  }

  try {
    // Créer ou récupérer la conversation
    const conversationId = await ensureVolunteerToOrganizersConversation(editionId, user.id)

    return {
      conversationId,
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la conversation:', error)
    throw createError({
      status: 500,
      message: error.message || 'Erreur lors de la création de la conversation',
    })
  }
})
