import { requireGlobalAdmin } from '../../../utils/admin-auth'
import { NotificationHelpers } from '../../../utils/notification-service'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdmin(event)

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Trouver les éditions qui commencent dans 3 ou 7 jours
    const upcomingEditions = await prisma.edition.findMany({
      where: {
        dateStart: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        convention: {
          select: {
            name: true,
          },
        },
        // Récupérer les utilisateurs qui ont mis cette édition en favori
        favoritedBy: {
          select: {
            id: true,
            pseudo: true,
          },
        },
        // Récupérer les bénévoles acceptés
        volunteerApplications: {
          where: {
            status: 'ACCEPTED',
          },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
              },
            },
          },
        },
      },
    })

    let remindersSent = 0

    for (const edition of upcomingEditions) {
      const daysUntil = Math.ceil(
        (edition.dateStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Envoyer des rappels seulement pour 3 ou 7 jours
      if (daysUntil === 3 || daysUntil === 7) {
        const usersToNotify = new Set<number>()

        // Ajouter les utilisateurs qui ont mis en favori
        edition.favoritedBy.forEach((user) => {
          usersToNotify.add(user.id)
        })

        // Ajouter les bénévoles acceptés
        edition.volunteerApplications.forEach((app) => {
          usersToNotify.add(app.user.id)
        })

        // Envoyer les notifications
        for (const userId of usersToNotify) {
          try {
            // Vérifier si un rappel a déjà été envoyé pour cette édition et cet utilisateur
            const existingNotification = await prisma.notification.findFirst({
              where: {
                userId,
                category: 'edition',
                entityType: 'Edition',
                entityId: edition.id.toString(),
                title: {
                  contains: 'Rappel',
                },
                createdAt: {
                  gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Dans les dernières 24h
                },
              },
            })

            if (!existingNotification) {
              await NotificationHelpers.eventReminder(
                userId,
                `${edition.convention.name} - ${edition.title}`,
                edition.id,
                daysUntil
              )
              remindersSent++
            }
          } catch (error) {
            console.error(`Erreur lors de l'envoi du rappel pour l'utilisateur ${userId}:`, error)
          }
        }
      }
    }

    return {
      success: true,
      message: `${remindersSent} rappel${remindersSent > 1 ? 's' : ''} envoyé${remindersSent > 1 ? 's' : ''}`,
      editionsProcessed: upcomingEditions.length,
      remindersSent,
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi des rappels:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'envoi des rappels",
    })
  }
})
