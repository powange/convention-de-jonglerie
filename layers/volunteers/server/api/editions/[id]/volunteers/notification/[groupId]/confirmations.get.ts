import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = getRouterParam(event, 'groupId')

    // Vérifier les permissions
    const canManage = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
    if (!canManage) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    if (!groupId) {
      throw createError({ status: 400, message: 'ID de groupe requis' })
    }

    // Récupérer le groupe de notifications avec les confirmations
    const notificationGroup = await prisma.volunteerNotificationGroup.findFirst({
      where: {
        id: groupId,
        eventId: editionId,
      },
      include: {
        event: {
          select: { name: true },
        },
        sender: {
          select: { pseudo: true },
        },
        confirmations: {
          include: {
            user: {
              select: {
                ...userWithNameSelect,
                email: true,
                phone: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            confirmedAt: 'desc',
          },
        },
      },
    })

    if (!notificationGroup) {
      throw createError({ status: 404, message: 'Notification introuvable' })
    }

    // Récupérer tous les destinataires originaux (pour identifier ceux qui n'ont pas confirmé)
    const whereClause: any = {
      eventId: editionId,
      status: 'ACCEPTED',
    }

    /*
     * Si on ciblait des équipes spécifiques.
     *
     * ⚠️ CE QUI N'ALLAIT PAS : ce filtre portait sur `assignedTeams`, un champ JSON qui N'EXISTE
     * PLUS sur `EditionVolunteerApplication` — les équipes vivent dans la relation
     * `teamAssignments` depuis le passage aux `VolunteerTeam`. Prisma rejetait donc la requête
     * ENTIÈRE (`Unknown argument 'assignedTeams'`), et l'écran de suivi d'une notification
     * répondait 500 : l'organisateur ne pouvait pas savoir qui avait confirmé. Relevé 12 fois en
     * production le 30/09/2026 sur une seule édition — il a réessayé.
     *
     * 📍 LA SÉLECTION EST CELLE DE L'ENVOI, à l'identique (`notifications.post.ts`), et ce n'est
     * pas une commodité : cet écran compare les destinataires aux confirmations. Deux façons de
     * répondre à « qui était visé ? » donneraient un taux de confirmation faux — un défaut
     * silencieux, là où celui-ci au moins criait.
     *
     * 📍 Ce point d'API avait été OUBLIÉ par la migration : son voisin porte depuis le début le
     * commentaire « utiliser la relation teamAssignments au lieu du champ JSON assignedTeams ».
     */
    if (
      notificationGroup.targetType === 'teams' &&
      notificationGroup.selectedTeams &&
      Array.isArray(notificationGroup.selectedTeams) &&
      notificationGroup.selectedTeams.length > 0
    ) {
      whereClause.teamAssignments = {
        some: {
          team: {
            name: {
              in: notificationGroup.selectedTeams as string[],
            },
          },
        },
      }
    }

    const allRecipients = await prisma.editionVolunteerApplication.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            ...userWithNameSelect,
            email: true,
            phone: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
      },
    })

    // Créer un set des IDs qui ont vraiment confirmé (confirmedAt non null)
    const confirmedUserIds = new Set(
      notificationGroup.confirmations.filter((c) => c.confirmedAt !== null).map((c) => c.user.id)
    )

    // Séparer les bénévoles confirmés et non confirmés
    const confirmedVolunteers = allRecipients.filter((volunteer) =>
      confirmedUserIds.has(volunteer.user.id)
    )
    const pendingVolunteers = allRecipients.filter(
      (volunteer) => !confirmedUserIds.has(volunteer.user.id)
    )

    // Calculer les statistiques
    const actualConfirmationsCount = notificationGroup.confirmations.filter(
      (c) => c.confirmedAt !== null
    ).length
    const confirmationRate =
      notificationGroup.recipientCount > 0
        ? (actualConfirmationsCount / notificationGroup.recipientCount) * 100
        : 0

    return {
      notification: {
        id: notificationGroup.id,
        title: notificationGroup.title,
        message: notificationGroup.message,
        targetType: notificationGroup.targetType,
        selectedTeams: notificationGroup.selectedTeams,
        recipientCount: notificationGroup.recipientCount,
        sentAt: notificationGroup.sentAt,
        senderName: notificationGroup.sender?.pseudo ?? null,
        // Étape 0bis : le nom d'affichage générique est porté par Event (« Convention - Edition »)
        editionName: notificationGroup.event.name ?? null,
        conventionName: null,
      },
      confirmed: confirmedVolunteers.map((volunteer) => {
        const confirmation = notificationGroup.confirmations.find(
          (c) => c.user.id === volunteer.user.id
        )
        return {
          user: {
            id: volunteer.user.id,
            pseudo: volunteer.user.pseudo,
            prenom: volunteer.user.prenom,
            nom: volunteer.user.nom,
            pronouns: volunteer.user.pronouns,
            email: volunteer.user.email,
            phone: volunteer.user.phone,
            profilePicture: volunteer.user.profilePicture,
            emailHash: volunteer.user.emailHash,
            updatedAt: volunteer.user.updatedAt,
          },
          confirmedAt: confirmation?.confirmedAt,
        }
      }),
      pending: pendingVolunteers.map((volunteer) => ({
        user: {
          id: volunteer.user.id,
          pseudo: volunteer.user.pseudo,
          prenom: volunteer.user.prenom,
          nom: volunteer.user.nom,
          pronouns: volunteer.user.pronouns,
          email: volunteer.user.email,
          phone: volunteer.user.phone,
          profilePicture: volunteer.user.profilePicture,
          emailHash: volunteer.user.emailHash,
          updatedAt: volunteer.user.updatedAt,
        },
      })),
      stats: {
        totalRecipients: allRecipients.length,
        confirmationsCount: actualConfirmationsCount,
        confirmationRate: Math.round(confirmationRate * 100) / 100, // 2 décimales
        pendingCount: pendingVolunteers.length,
      },
    }
  },
  { operationName: 'GetVolunteerNotificationConfirmations' }
)
