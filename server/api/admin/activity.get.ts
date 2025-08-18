import { PrismaClient } from '@prisma/client'
import { requireUserSession } from '#imports'
import type { H3Error } from 'h3'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification via la session scellée
    const { user } = await requireUserSession(event)

    // Vérifier que l'utilisateur est un super administrateur
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isGlobalAdmin: true }
    })

    if (!currentUser?.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accès refusé - Droits super administrateur requis'
      })
    }

  const limit = parseInt(getQuery(event).limit as string) || 10

    // Récupérer les activités récentes en parallèle
  const [
      recentUsers,
      recentConventions,
      recentEditions,
      recentAdminPromotions
    ] = await Promise.all([
      // Nouveaux utilisateurs
      prisma.user.findMany({
        select: {
          id: true,
          prenom: true,
          nom: true,
          pseudo: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4)
      }),
      
      // Nouvelles conventions
      prisma.convention.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          author: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4)
      }),
      
      // Nouvelles éditions
      prisma.edition.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          creator: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true
            }
          },
          convention: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4)
      }),
      
      // Promotions admin récentes (utilisateurs devenus admin récemment)
      prisma.user.findMany({
        where: {
          isGlobalAdmin: true,
          updatedAt: {
            gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 derniers jours
          }
        },
        select: {
          id: true,
          prenom: true,
          nom: true,
          pseudo: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4)
      })
    ])

    // Combiner et formater les activités
    type Activity = {
      id: string
      type: 'user_registered' | 'convention_created' | 'edition_created' | 'admin_promoted'
      title: string
      description: string
      createdAt: string
      relatedId: number
      relatedType: 'user' | 'convention' | 'edition'
    }
    const activities: Activity[] = []

    // Ajouter les nouveaux utilisateurs
    recentUsers.forEach(user => {
      activities.push({
        id: `user_${user.id}`,
        type: 'user_registered',
        title: 'Nouvel utilisateur inscrit',
        description: `${user.prenom} ${user.nom} (@${user.pseudo}) s'est inscrit sur la plateforme`,
        createdAt: user.createdAt.toISOString(),
        relatedId: user.id,
        relatedType: 'user'
      })
    })

    // Ajouter les nouvelles conventions
    recentConventions.forEach(convention => {
      activities.push({
        id: `convention_${convention.id}`,
        type: 'convention_created',
        title: 'Nouvelle convention créée',
        description: `"${convention.name}" créée par ${convention.author.prenom} ${convention.author.nom}`,
        createdAt: convention.createdAt.toISOString(),
        relatedId: convention.id,
        relatedType: 'convention'
      })
    })

    // Ajouter les nouvelles éditions
    recentEditions.forEach(edition => {
      const editionName = edition.name || `Édition de ${edition.convention.name}`
      activities.push({
        id: `edition_${edition.id}`,
        type: 'edition_created',
        title: 'Nouvelle édition créée',
        description: `"${editionName}" créée par ${edition.creator.prenom} ${edition.creator.nom}`,
        createdAt: edition.createdAt.toISOString(),
        relatedId: edition.id,
        relatedType: 'edition'
      })
    })

    // Ajouter les promotions admin
    recentAdminPromotions.forEach(admin => {
      activities.push({
        id: `admin_${admin.id}`,
        type: 'admin_promoted',
        title: 'Nouvelle promotion administrateur',
        description: `${admin.prenom} ${admin.nom} (@${admin.pseudo}) est devenu super administrateur`,
        createdAt: admin.updatedAt.toISOString(),
        relatedId: admin.id,
        relatedType: 'user'
      })
    })

    // Trier par date décroissante et limiter
    const sortedActivities = activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)

    return sortedActivities

  } catch (error: unknown) {
    console.error('Erreur lors de la récupération de l\'activité récente:', error)
    if ((error as H3Error)?.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur'
    })
  }
})