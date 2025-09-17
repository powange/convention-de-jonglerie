import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const updateUserSchema = z.object({
  email: z.string().email('Email invalide'),
  pseudo: z.string().min(2, 'Le pseudo doit contenir au moins 2 caractères'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  nom: z.string().min(1, 'Le nom est requis'),
  phone: z.string().optional(),
})

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
    const body = await readBody(event)

    // Valider les données d'entrée
    const validatedData = updateUserSchema.parse(body)

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

    // Vérifier l'unicité de l'email et du pseudo si ils ont changé
    if (validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: userId },
        },
      })

      if (emailExists) {
        throw createError({
          statusCode: 409,
          message: 'Cette adresse email est déjà utilisée',
        })
      }
    }

    if (validatedData.pseudo !== existingUser.pseudo) {
      const pseudoExists = await prisma.user.findFirst({
        where: {
          pseudo: validatedData.pseudo,
          id: { not: userId },
        },
      })

      if (pseudoExists) {
        throw createError({
          statusCode: 409,
          message: 'Ce pseudo est déjà utilisé',
        })
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: validatedData.email,
        pseudo: validatedData.pseudo,
        prenom: validatedData.prenom,
        nom: validatedData.nom,
        phone: validatedData.phone || null,
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
    console.error("Erreur lors de la mise à jour de l'utilisateur:", error)

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
      message: "Erreur serveur lors de la mise à jour de l'utilisateur",
    })
  }
})
