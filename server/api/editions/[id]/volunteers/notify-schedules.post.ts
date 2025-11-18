import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  sendEmail,
  generateVolunteerScheduleEmailHtml,
  getSiteUrl,
} from '@@/server/utils/emailService'
import { NotificationService } from '@@/server/utils/notification-service'
import { canManageEditionVolunteers } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { userBasicSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
    })
  }

  // Récupérer l'édition avec les informations nécessaires
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Édition non trouvée',
    })
  }

  // Récupérer tous les bénévoles acceptés
  const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
    where: {
      editionId,
      status: 'ACCEPTED',
    },
    include: {
      user: {
        select: {
          ...userBasicSelect,
          email: true,
          prenom: true,
          preferredLanguage: true,
        },
      },
    },
  })

  if (acceptedVolunteers.length === 0) {
    return {
      success: true,
      message: 'Aucun bénévole accepté trouvé',
      count: 0,
    }
  }

  const siteUrl = getSiteUrl()
  let successCount = 0
  let errorCount = 0

  // Envoyer une notification à chaque bénévole
  for (const volunteer of acceptedVolunteers) {
    try {
      // Récupérer les créneaux assignés à ce bénévole
      const assignments = await prisma.volunteerAssignment.findMany({
        where: {
          userId: volunteer.user.id,
          timeSlot: {
            editionId,
          },
        },
        include: {
          timeSlot: {
            include: {
              team: true,
            },
          },
        },
        orderBy: {
          timeSlot: {
            startDateTime: 'asc',
          },
        },
      })

      // Formater les créneaux pour l'affichage
      const scheduleText = assignments
        .map((assignment) => {
          // Calculer les dates ajustées avec le retard
          const delay = assignment.timeSlot.delayMinutes || 0
          const adjustedStart = new Date(
            assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000
          )
          const adjustedEnd = new Date(
            assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000
          )

          const date = adjustedStart.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
          const timeRange = `${adjustedStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${adjustedEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          const teamName = assignment.timeSlot.team?.name || 'Équipe non définie'
          return `📅 ${date} (${timeRange}) - ${teamName}`
        })
        .join('\n')

      // Créer la notification
      const notificationTitle = 'Vos créneaux de bénévolat sont disponibles'
      const notificationMessage =
        assignments.length > 0
          ? `Vos créneaux de bénévolat pour ${edition.convention.name} sont maintenant disponibles :\n\n${scheduleText}\n\nConsultez tous vos créneaux sur la page "Mes candidatures".`
          : `Vos créneaux de bénévolat pour ${edition.convention.name} seront bientôt disponibles. Consultez la page "Mes candidatures" pour plus d'informations.`

      await NotificationService.create({
        userId: volunteer.user.id,
        type: 'INFO',
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: '/my-volunteer-applications',
        actionText: 'Voir mes créneaux',
        entityType: 'Edition',
        entityId: editionId.toString(),
        notificationType: 'volunteer_schedule',
      })

      // Envoyer l'email
      const prenom = volunteer.user.prenom || volunteer.user.pseudo || 'Bénévole'

      // Préparer les créneaux pour l'email avec le format attendu
      const emailTimeSlots = assignments.map((assignment) => {
        // Calculer les dates ajustées avec le retard
        const delay = assignment.timeSlot.delayMinutes || 0
        const startDate = new Date(assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000)
        const endDate = new Date(assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000)

        // Déterminer le moment de la journée basé sur l'heure de début ajustée
        const hour = startDate.getHours()
        let timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING'
        if (hour < 12) {
          timeOfDay = 'MORNING'
        } else if (hour < 18) {
          timeOfDay = 'AFTERNOON'
        } else {
          timeOfDay = 'EVENING'
        }

        return {
          date: startDate,
          timeOfDay,
          teamName: assignment.timeSlot.team?.name || 'Équipe non définie',
          startTime: startDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          endTime: endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        }
      })

      const emailHtml = await generateVolunteerScheduleEmailHtml(
        prenom,
        edition.convention.name,
        edition.name || edition.convention.name,
        emailTimeSlots,
        `${siteUrl}/my-volunteer-applications`
      )

      const emailSent = await sendEmail({
        to: volunteer.user.email,
        subject: `🤹 Vos créneaux de bénévolat - ${edition.convention.name}`,
        html: emailHtml,
        text: `Bonjour ${prenom},\n\n${notificationMessage}\n\nLien : ${siteUrl}/my-volunteer-applications`,
      })

      if (!emailSent) {
        console.warn(`Échec de l'envoi d'email pour ${volunteer.user.email}`)
        errorCount++
      } else {
        successCount++
      }
    } catch (error) {
      console.error(`Erreur lors de l'envoi pour le bénévole ${volunteer.user.id}:`, error)
      errorCount++
    }
  }

  return {
    success: true,
    message: `Notifications envoyées à ${successCount} bénévole(s)`,
    count: successCount,
    errors: errorCount,
    total: acceptedVolunteers.length,
  }
}, 'NotifyVolunteerSchedules')
