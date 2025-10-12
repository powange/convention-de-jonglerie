import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const userId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'ID utilisateur invalide',
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        isEmailVerified: true,
        isGlobalAdmin: true,
        createdAt: true,
        updatedAt: true,
        profilePicture: true,
        _count: {
          select: {
            createdConventions: true,
            createdEditions: true,
            favoriteEditions: true,
          },
        },
      },
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur introuvable',
      })
    }

    return user
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error)

    // Si c'est déjà une erreur HTTP, la relancer
    if ((error as any)?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur serveur lors de la récupération de l'utilisateur",
    })
  }
})
