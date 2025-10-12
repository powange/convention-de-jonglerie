import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const offerId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(offerId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'offre invalide",
    })
  }

  try {
    // Vérifier que l'offre existe et que l'utilisateur en est le créateur
    const existingOffer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
    })

    if (!existingOffer) {
      throw createError({
        statusCode: 404,
        message: 'Offre de covoiturage introuvable',
      })
    }

    // Seul le créateur peut supprimer son offre
    if (existingOffer.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour supprimer cette offre",
      })
    }

    // Supprimer l'offre (les commentaires seront supprimés automatiquement grâce à CASCADE)
    await prisma.carpoolOffer.delete({
      where: { id: offerId },
    })

    return { message: 'Offre de covoiturage supprimée avec succès' }
  } catch (error: unknown) {
    console.error("Erreur lors de la suppression de l'offre de covoiturage:", error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'offre",
    })
  }
})
