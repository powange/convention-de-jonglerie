import { avecCoequipiers, coequipiersSelect } from '../../../../utils/coequipiers-creneau'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/volunteers/my-slots
 *
 * Les créneaux de l'utilisateur connecté sur cette édition, qu'il les tienne comme bénévole
 * accepté ou comme organisateur rattaché.
 *
 * `my-application` ne pouvait pas s'en charger : elle part d'une candidature, et un
 * organisateur qui n'est pas bénévole n'en a pas. Il voyait donc ses créneaux affectés par les
 * responsables du planning sans jamais pouvoir les consulter lui-même.
 *
 * Chaque créneau porte son `origine`, parce que les deux ne se valent pas : un créneau de
 * bénévole peut être échangé, celui d'un organisateur non.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const selectionCreneau = {
      id: true,
      title: true,
      startDateTime: true,
      endDateTime: true,
      delayMinutes: true,
      team: { select: { id: true, name: true, color: true } },
      assignments: coequipiersSelect(user.id),
    }

    const [commeBenevole, commeOrganisateur] = await Promise.all([
      prisma.volunteerAssignment.findMany({
        where: { userId: user.id, timeSlot: { eventId: editionId } },
        select: { id: true, assignedAt: true, timeSlot: { select: selectionCreneau } },
      }),
      prisma.organizerSlotAssignment.findMany({
        where: {
          timeSlot: { eventId: editionId },
          editionOrganizer: { editionId, organizer: { userId: user.id } },
        },
        select: { assignedAt: true, timeSlot: { select: selectionCreneau } },
      }),
    ])

    const creneaux = [
      ...commeBenevole.map((affectation) => ({
        id: affectation.id,
        assignedAt: affectation.assignedAt,
        origine: 'VOLUNTEER' as const,
        timeSlot: avecCoequipiers(affectation.timeSlot),
      })),
      ...commeOrganisateur.map((affectation) => ({
        // Pas d'identifiant propre sur cette table : sa clé est le couple
        // (organisateur, créneau). Celui du créneau suffit à distinguer les lignes ici.
        id: `organizer-${affectation.timeSlot.id}`,
        assignedAt: affectation.assignedAt,
        origine: 'ORGANIZER' as const,
        timeSlot: avecCoequipiers(affectation.timeSlot),
      })),
    ].sort(
      (a, b) =>
        new Date(a.timeSlot.startDateTime).getTime() - new Date(b.timeSlot.startDateTime).getTime()
    )

    return createSuccessResponse({ slots: creneaux })
  },
  { operationName: 'GetMyVolunteerSlots' }
)
