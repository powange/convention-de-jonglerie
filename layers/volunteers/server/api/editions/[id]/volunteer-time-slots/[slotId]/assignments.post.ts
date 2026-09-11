import { z } from 'zod'

import { CRENEAU_COMPLET, resteUnePlace } from '../../../../../utils/places-creneau'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userBasicSelect, userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateStringId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

const assignVolunteerSchema = z.object({
  userId: z.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const slotId = validateStringId(event, 'slotId', 'créneau')

    // Vérifier les permissions de gestion des bénévoles
    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, assignVolunteerSchema.parse)

    // Vérifier que le bénévole a une candidature acceptée pour cette édition. Hors transaction :
    // ce contrôle ne dépend pas du remplissage du créneau, et l'échec est immédiat.
    const application = await prisma.editionVolunteerApplication.findFirst({
      where: {
        userId: body.userId,
        eventId: editionId,
        status: 'ACCEPTED',
      },
    })

    if (!application) {
      throw createError({
        status: 400,
        message: 'Bénévole non trouvé ou candidature non acceptée pour cette édition',
      })
    }

    /*
     * Le relevé des places et la création tiennent dans la même transaction.
     *
     * Ce que cela apporte, et rien de plus : la fenêtre entre « il reste une place » et « elle est
     * prise » se resserre. Elle ne se ferme pas. Aucun verrou n'est posé sur le créneau, si bien
     * que deux transactions concurrentes peuvent encore lire le même total et accorder toutes deux
     * la dernière place. Fermer vraiment demanderait un verrou de ligne au moment du relevé — un
     * `SELECT … FOR UPDATE` sur le créneau —, ce que Prisma n'exprime qu'en SQL brut. C'est le même
     * choix, et la même limite, que pour les réservations de matériel.
     */
    const assignment = await prisma.$transaction(async (tx) => {
      // Vérifier que le créneau existe et appartient à cette édition
      const timeSlot = await tx.volunteerTimeSlot.findFirst({
        where: {
          id: slotId,
          eventId: editionId,
        },
        select: {
          maxVolunteers: true,
          _count: {
            select: {
              assignments: true,
              // Un organisateur occupe une place comme un bénévole : l'ignorer ici laisserait
              // s'ajouter un bénévole de trop sur un créneau déjà pourvu.
              organizerAssignments: true,
            },
          },
        },
      })

      if (!timeSlot) {
        throw createError({
          status: 404,
          message: "Créneau non trouvé ou n'appartient pas à cette édition",
        })
      }

      // Vérifier que le bénévole n'est pas déjà assigné à ce créneau
      const existingAssignment = await tx.volunteerAssignment.findUnique({
        where: {
          timeSlotId_userId: {
            timeSlotId: slotId,
            userId: body.userId,
          },
        },
      })

      if (existingAssignment) {
        throw createError({
          status: 400,
          message: 'Ce bénévole est déjà assigné à ce créneau',
        })
      }

      if (!resteUnePlace(timeSlot)) {
        throw createError({
          status: 400,
          message: CRENEAU_COMPLET,
        })
      }

      // Créer l'assignation
      return await tx.volunteerAssignment.create({
        data: {
          timeSlotId: slotId,
          userId: body.userId,
          assignedById: event.context.user!.id,
        },
        include: {
          user: {
            select: {
              ...userWithNameSelect,
              email: true,
            },
          },
          assignedBy: {
            select: userBasicSelect,
          },
        },
      })
    })

    return createSuccessResponse(assignment, 'Bénévole assigné avec succès')
  },
  { operationName: 'CreateVolunteerTimeSlotAssignment' }
)
