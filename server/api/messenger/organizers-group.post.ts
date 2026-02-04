import { ensureOrganizersGroupConversation } from '@@/server/utils/messenger-helpers'

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

  // Vérifier que l'utilisateur est bien un organisateur de cette édition
  const isOrganizer = await prisma.editionOrganizer.findFirst({
    where: {
      editionId,
      userId: user.id,
    },
  })

  if (!isOrganizer) {
    throw createError({
      status: 403,
      message: "Vous n'êtes pas organisateur de cette édition",
    })
  }

  try {
    // Créer ou récupérer la conversation
    const conversationId = await ensureOrganizersGroupConversation(editionId)

    return {
      conversationId,
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la conversation organisateurs:', error)
    throw createError({
      status: 500,
      message: error.message || 'Erreur lors de la création de la conversation',
    })
  }
})
