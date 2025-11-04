import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const limit = parseInt(getQuery(event).limit as string) || 10

    // Récupérer les activités récentes en parallèle
    const [
      recentUsers,
      recentConventions,
      recentEditions,
      recentAdminPromotions,
      recentVolunteerApplications,
      recentClaimRequests,
      recentCollaborators,
      recentFeedback,
      recentCarpoolOffers,
      recentCarpoolRequests,
      recentVolunteerNotifications,
    ] = await Promise.all([
      // Nouveaux utilisateurs
      prisma.user.findMany({
        select: {
          id: true,
          prenom: true,
          nom: true,
          pseudo: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
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
              pseudo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
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
              pseudo: true,
            },
          },
          convention: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Promotions admin récentes (utilisateurs devenus admin récemment)
      prisma.user.findMany({
        where: {
          isGlobalAdmin: true,
          updatedAt: {
            gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
          },
        },
        select: {
          id: true,
          prenom: true,
          nom: true,
          pseudo: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Candidatures bénévoles récentes
      prisma.editionVolunteerApplication.findMany({
        select: {
          id: true,
          status: true,
          createdAt: true,
          decidedAt: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
          edition: {
            select: {
              name: true,
              convention: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Demandes de revendication récentes
      prisma.conventionClaimRequest.findMany({
        select: {
          id: true,
          isVerified: true,
          createdAt: true,
          verifiedAt: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
          convention: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Nouveaux collaborateurs récents
      prisma.conventionCollaborator.findMany({
        select: {
          id: true,
          addedAt: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
          convention: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { addedAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Feedback récent
      prisma.feedback.findMany({
        select: {
          id: true,
          type: true,
          resolved: true,
          subject: true,
          createdAt: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Offres de covoiturage récentes
      prisma.carpoolOffer.findMany({
        select: {
          id: true,
          createdAt: true,
          availableSeats: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
          edition: {
            select: {
              name: true,
              convention: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Demandes de covoiturage récentes
      prisma.carpoolRequest.findMany({
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              prenom: true,
              nom: true,
              pseudo: true,
            },
          },
          edition: {
            select: {
              name: true,
              convention: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),

      // Notifications aux bénévoles récentes
      prisma.volunteerNotificationGroup.findMany({
        select: {
          id: true,
          title: true,
          message: true,
          sentAt: true,
          edition: {
            select: {
              name: true,
              convention: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: Math.ceil(limit / 4),
      }),
    ])

    // Combiner et formater les activités
    type Activity = {
      id: string
      type:
        | 'user_registered'
        | 'convention_created'
        | 'edition_created'
        | 'admin_promoted'
        | 'volunteer_applied'
        | 'volunteer_accepted'
        | 'volunteer_rejected'
        | 'convention_claimed'
        | 'claim_approved'
        | 'claim_rejected'
        | 'collaborator_added'
        | 'feedback_submitted'
        | 'feedback_resolved'
        | 'carpool_offer_created'
        | 'carpool_request_created'
        | 'volunteer_notification_sent'
      title: string
      description: string
      createdAt: string
      relatedId: number | string
      relatedType: 'user' | 'convention' | 'edition' | 'feedback' | 'carpool' | 'notification'
    }
    const activities: Activity[] = []

    // Ajouter les nouveaux utilisateurs
    recentUsers.forEach((user) => {
      const userName = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.pseudo

      activities.push({
        id: `user_${user.id}`,
        type: 'user_registered',
        title: 'Nouvel utilisateur inscrit',
        description: `${userName} (@${user.pseudo}) s'est inscrit sur la plateforme`,
        createdAt: user.createdAt.toISOString(),
        relatedId: user.id,
        relatedType: 'user',
      })
    })

    // Ajouter les nouvelles conventions
    recentConventions.forEach((convention) => {
      const authorName = convention.author
        ? `${convention.author.prenom || ''} ${convention.author.nom || ''}`.trim() ||
          convention.author.pseudo
        : 'Créateur inconnu'

      activities.push({
        id: `convention_${convention.id}`,
        type: 'convention_created',
        title: 'Nouvelle convention créée',
        description: `"${convention.name}" créée par ${authorName}`,
        createdAt: convention.createdAt.toISOString(),
        relatedId: convention.id,
        relatedType: 'convention',
      })
    })

    // Ajouter les nouvelles éditions
    recentEditions.forEach((edition) => {
      const editionName = edition.name || `Édition de ${edition.convention.name}`
      const creatorName = edition.creator
        ? `${edition.creator.prenom || ''} ${edition.creator.nom || ''}`.trim() ||
          edition.creator.pseudo
        : 'Créateur inconnu'

      activities.push({
        id: `edition_${edition.id}`,
        type: 'edition_created',
        title: 'Nouvelle édition créée',
        description: `"${editionName}" créée par ${creatorName}`,
        createdAt: edition.createdAt.toISOString(),
        relatedId: edition.id,
        relatedType: 'edition',
      })
    })

    // Ajouter les promotions admin
    recentAdminPromotions.forEach((admin) => {
      const adminName = `${admin.prenom || ''} ${admin.nom || ''}`.trim() || admin.pseudo

      activities.push({
        id: `admin_${admin.id}`,
        type: 'admin_promoted',
        title: 'Nouvelle promotion administrateur',
        description: `${adminName} (@${admin.pseudo}) est devenu super administrateur`,
        createdAt: admin.updatedAt.toISOString(),
        relatedId: admin.id,
        relatedType: 'user',
      })
    })

    // Ajouter les candidatures bénévoles
    recentVolunteerApplications.forEach((application) => {
      const userName = application.user
        ? `${application.user.prenom || ''} ${application.user.nom || ''}`.trim() ||
          application.user.pseudo
        : 'Utilisateur inconnu'

      const editionName = application.edition?.name || application.edition?.convention?.name

      let activityType: Activity['type']
      let title: string
      let description: string
      let activityDate: string

      switch (application.status) {
        case 'PENDING':
          activityType = 'volunteer_applied'
          title = 'Nouvelle candidature bénévole'
          description = `${userName} a postulé pour "${editionName}"`
          activityDate = application.createdAt.toISOString()
          break
        case 'ACCEPTED':
          activityType = 'volunteer_accepted'
          title = 'Candidature bénévole acceptée'
          description = `${userName} a été accepté(e) pour "${editionName}"`
          activityDate = application.decidedAt?.toISOString() || application.createdAt.toISOString()
          break
        case 'REJECTED':
          activityType = 'volunteer_rejected'
          title = 'Candidature bénévole refusée'
          description = `${userName} a été refusé(e) pour "${editionName}"`
          activityDate = application.decidedAt?.toISOString() || application.createdAt.toISOString()
          break
        default:
          return // Skip unknown statuses
      }

      activities.push({
        id: `volunteer_${application.id}_${application.status}`,
        type: activityType,
        title,
        description,
        createdAt: activityDate,
        relatedId: application.id,
        relatedType: 'user',
      })
    })

    // Ajouter les demandes de revendication
    recentClaimRequests.forEach((claim) => {
      const userName = claim.user
        ? `${claim.user.prenom || ''} ${claim.user.nom || ''}`.trim() || claim.user.pseudo
        : 'Utilisateur inconnu'

      let activityType: Activity['type']
      let title: string
      let description: string
      let activityDate: string

      if (claim.isVerified) {
        activityType = 'claim_approved'
        title = 'Revendication approuvée'
        description = `${userName} a récupéré la convention "${claim.convention.name}"`
        activityDate = claim.verifiedAt?.toISOString() || claim.createdAt.toISOString()
      } else {
        activityType = 'convention_claimed'
        title = 'Demande de revendication'
        description = `${userName} demande à revendiquer "${claim.convention.name}"`
        activityDate = claim.createdAt.toISOString()
      }

      activities.push({
        id: `claim_${claim.id}_${claim.isVerified ? 'verified' : 'pending'}`,
        type: activityType,
        title,
        description,
        createdAt: activityDate,
        relatedId: claim.id,
        relatedType: 'convention',
      })
    })

    // Ajouter les nouveaux collaborateurs
    recentCollaborators.forEach((collaborator) => {
      const userName = collaborator.user
        ? `${collaborator.user.prenom || ''} ${collaborator.user.nom || ''}`.trim() ||
          collaborator.user.pseudo
        : 'Utilisateur inconnu'

      activities.push({
        id: `collaborator_${collaborator.id}`,
        type: 'collaborator_added',
        title: 'Nouveau collaborateur ajouté',
        description: `${userName} a été ajouté comme collaborateur de "${collaborator.convention.name}"`,
        createdAt: collaborator.addedAt.toISOString(),
        relatedId: collaborator.id,
        relatedType: 'convention',
      })
    })

    // Ajouter le feedback
    recentFeedback.forEach((feedback) => {
      const userName = feedback.user
        ? `${feedback.user.prenom || ''} ${feedback.user.nom || ''}`.trim() || feedback.user.pseudo
        : 'Utilisateur anonyme'

      const activityType = feedback.resolved ? 'feedback_resolved' : 'feedback_submitted'
      const title = feedback.resolved ? 'Feedback résolu' : 'Nouveau feedback'
      const description = feedback.resolved
        ? `Feedback "${feedback.subject}" de ${userName} résolu`
        : `${userName} a soumis un feedback: "${feedback.subject}" (${feedback.type})`

      activities.push({
        id: `feedback_${feedback.id}`,
        type: activityType,
        title,
        description,
        createdAt: feedback.createdAt.toISOString(),
        relatedId: feedback.id,
        relatedType: 'feedback',
      })
    })

    // Ajouter les offres de covoiturage
    recentCarpoolOffers.forEach((offer) => {
      const driverName = offer.user
        ? `${offer.user.prenom || ''} ${offer.user.nom || ''}`.trim() || offer.user.pseudo
        : 'Conducteur inconnu'

      const editionName = offer.edition?.name || offer.edition?.convention?.name

      activities.push({
        id: `carpool_offer_${offer.id}`,
        type: 'carpool_offer_created',
        title: 'Nouvelle offre de covoiturage',
        description: `${driverName} propose ${offer.availableSeats} places pour "${editionName}"`,
        createdAt: offer.createdAt.toISOString(),
        relatedId: offer.id,
        relatedType: 'carpool',
      })
    })

    // Ajouter les demandes de covoiturage
    recentCarpoolRequests.forEach((request) => {
      const userName = request.user
        ? `${request.user.prenom || ''} ${request.user.nom || ''}`.trim() || request.user.pseudo
        : 'Utilisateur inconnu'

      const editionName = request.edition?.name || request.edition?.convention?.name

      activities.push({
        id: `carpool_request_${request.id}`,
        type: 'carpool_request_created',
        title: 'Nouvelle demande de covoiturage',
        description: `${userName} cherche un covoiturage pour "${editionName}"`,
        createdAt: request.createdAt.toISOString(),
        relatedId: request.id,
        relatedType: 'carpool',
      })
    })

    // Ajouter les notifications aux bénévoles
    recentVolunteerNotifications.forEach((notification) => {
      const editionName = notification.edition?.name || notification.edition?.convention?.name

      activities.push({
        id: `notification_${notification.id}`,
        type: 'volunteer_notification_sent',
        title: 'Notification bénévoles envoyée',
        description: `"${notification.title}" envoyée aux bénévoles de "${editionName}"`,
        createdAt: notification.sentAt.toISOString(),
        relatedId: notification.id,
        relatedType: 'notification',
      })
    })

    // Trier par date décroissante et limiter
    const sortedActivities = activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)

    return sortedActivities
  },
  { operationName: 'GetAdminActivity' }
)
