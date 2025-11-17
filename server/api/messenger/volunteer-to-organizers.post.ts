import { ensureVolunteerToOrganizersConversation } from '@@/server/utils/messenger-helpers'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readBody(event)
  const { editionId } = body

  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: "L'ID de l'édition est requis",
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
      statusCode: 500,
      message: error.message || 'Erreur lors de la création de la conversation',
    })
  }
})
