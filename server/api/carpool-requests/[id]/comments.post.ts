import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const carpoolRequestId = parseInt(event.context.params?.id as string)
  const body = await readBody(event)

  if (!carpoolRequestId) {
    throw createError({
      statusCode: 400,
      message: 'Carpool Request ID invalide',
    })
  }

  // Validation des données
  if (!body.content || body.content.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Le commentaire ne peut pas être vide',
    })
  }

  try {
    // Vérifier que la demande de covoiturage existe
    const carpoolRequest = await prisma.carpoolRequest.findUnique({
      where: { id: carpoolRequestId },
    })

    if (!carpoolRequest) {
      throw createError({
        statusCode: 404,
        message: 'Demande de covoiturage non trouvée',
      })
    }

    // Créer le commentaire
    const comment = await prisma.carpoolRequestComment.create({
      data: {
        carpoolRequestId,
        userId: user.id,
        content: body.content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    })

    return comment
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
