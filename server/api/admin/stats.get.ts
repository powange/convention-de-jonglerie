import { PrismaClient } from '@prisma/client'

import { requireUserSession } from '#imports'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification via la session scellée
    const { user } = await requireUserSession(event)
    const userId = user.id

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      })
    }

    // Vérifier que l'utilisateur est un super administrateur
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    })

    if (!currentUser?.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accès refusé - Droits super administrateur requis',
      })
    }

    // Calculer les dates pour les statistiques mensuelles
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Récupérer toutes les statistiques en parallèle
    const [
      totalUsers,
      newUsersThisMonth,
      totalConventions,
      newConventionsThisMonth,
      totalEditions,
      newEditionsThisMonth,
      totalAdmins,
    ] = await Promise.all([
      // Total utilisateurs
      prisma.user.count(),

      // Nouveaux utilisateurs ce mois
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total conventions
      prisma.convention.count(),

      // Nouvelles conventions ce mois
      prisma.convention.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total éditions
      prisma.edition.count(),

      // Nouvelles éditions ce mois
      prisma.edition.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total super administrateurs
      prisma.user.count({
        where: {
          isGlobalAdmin: true,
        },
      }),
    ])

    return {
      totalUsers,
      newUsersThisMonth,
      totalConventions,
      newConventionsThisMonth,
      totalEditions,
      newEditionsThisMonth,
      totalAdmins,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    })
  }
})
