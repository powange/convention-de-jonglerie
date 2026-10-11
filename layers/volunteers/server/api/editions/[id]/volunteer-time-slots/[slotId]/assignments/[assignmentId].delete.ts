import { notifierRetraitDuCreneau } from '../../../../../../utils/notification-creneau'
import { planningPublieDeLEdition } from '../../../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')
    const assignmentId = validateStringId(event, 'assignmentId', 'assignation')

    // Vérifier les permissions de gestion des bénévoles
    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Vérifier que l'assignation existe et appartient à ce créneau/édition
    const assignment = await prisma.volunteerAssignment.findFirst({
      where: {
        id: assignmentId,
        timeSlotId: slotId,
        timeSlot: {
          eventId: editionId,
        },
      },
      include: {
        user: {
          select: userBasicSelect,
        },
        /*
         * Le créneau est demandé pour le MESSAGE de la notification — constat B4. Sans ses dates,
         * on annoncerait « vous avez été retiré d'un créneau » sans dire lequel, alors qu'un
         * bénévole en tient souvent plusieurs.
         */
        timeSlot: {
          select: {
            startDateTime: true,
            endDateTime: true,
            teamId: true,
            delayMinutes: true,
          },
        },
      },
    })

    if (!assignment) {
      throw createError({
        status: 404,
        message: 'Assignation non trouvée',
      })
    }

    // Supprimer l'assignation
    await prisma.volunteerAssignment.delete({
      where: {
        id: assignmentId,
      },
    })

    /*
     * Retirer quelqu'un de son créneau ne le lui disait pas — constat B4, second volet.
     *
     * Après la suppression, et sous garde : le port de notification ne lève pas, mais la lecture
     * du réglage et du fuseau peut, et un retrait déjà enregistré ne doit pas répondre 500.
     */
    try {
      if (await planningPublieDeLEdition(editionId)) {
        await notifierRetraitDuCreneau({
          editionId,
          userId: assignment.userId,
          creneau: assignment.timeSlot,
        })
      }
    } catch (erreur) {
      console.error(
        '[DeleteVolunteerTimeSlotAssignment] notification du retrait impossible :',
        erreur
      )
    }

    return createSuccessResponse(assignment.user, 'Assignation supprimée avec succès')
  },
  { operationName: 'DeleteVolunteerTimeSlotAssignment' }
)
