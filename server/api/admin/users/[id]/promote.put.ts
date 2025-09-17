import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const promoteUserSchema = z.object({
  isGlobalAdmin: z.boolean(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  const adminUser = await requireGlobalAdminWithDbCheck(event)

  const userId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'ID utilisateur invalide',
    })
  }

  // Empêcher l'auto-modification
  if (userId === adminUser.id) {
    throw createError({
      statusCode: 403,
      message: 'Vous ne pouvez pas modifier vos propres droits administrateur',
    })
  }

  try {
    const body = await readBody(event)

    // Valider les données d'entrée
    const validatedData = promoteUserSchema.parse(body)

    // Vérifier que l'utilisateur à modifier existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur introuvable',
      })
    }

    // Mettre à jour le statut administrateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isGlobalAdmin: validatedData.isGlobalAdmin,
        updatedAt: new Date(),
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

    return updatedUser
  } catch (error) {
    console.error("Erreur lors de la promotion/rétrogradation de l'utilisateur:", error)

    // Si c'est une erreur de validation Zod
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error.errors,
      })
    }

    // Si c'est déjà une erreur HTTP, la relancer
    if ((error as any)?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur serveur lors de la promotion/rétrogradation de l'utilisateur",
    })
  }
})
