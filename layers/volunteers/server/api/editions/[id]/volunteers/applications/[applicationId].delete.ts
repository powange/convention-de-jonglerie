import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const applicationId = validateResourceId(event, 'applicationId', 'candidature')

    // Vérifier les permissions
    const allowed = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    // Récupérer la candidature pour vérifier qu'elle existe et qu'elle est bien liée à cette édition
    const application = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        eventId: true,
        source: true,
        // Nécessaire au retrait des conversations : `user` ne suffit pas, les fils se joignent par
        // l'identifiant de l'utilisateur.
        userId: true,
        teamAssignments: { select: { teamId: true } },
        user: {
          select: {
            ...userWithNameSelect,
            emailHash: true,
          },
        },
      },
    })

    if (!application) {
      throw createError({
        status: 404,
        message: 'Candidature introuvable',
      })
    }

    // Vérifier que la candidature appartient bien à cette édition
    if (application.eventId !== editionId) {
      throw createError({
        status: 403,
        message: "Cette candidature n'appartient pas à cette édition",
      })
    }

    // Vérifier que la candidature a été ajoutée manuellement
    if (application.source !== 'MANUAL') {
      throw createError({
        status: 403,
        message: 'Seules les candidatures ajoutées manuellement peuvent être supprimées',
      })
    }

    /*
     * La candidature ET les conversations qu'elle ouvrait tombent ENSEMBLE.
     *
     * Supprimer la candidature emporte ses affectations en cascade, mais laissait intactes les
     * participations aux conversations : la personne restait dans les fils de ses anciennes équipes
     * et dans celui des organisateurs, alors même que plus rien ne la rattachait à l'édition.
     *
     * Le retrait vient AVANT la suppression : après, les affectations n'existent plus et l'on ne
     * saurait plus de quelles équipes retirer la personne.
     */
    await prisma.$transaction(async (tx) => {
      for (const affectation of application.teamAssignments) {
        await useVolunteerPorts().messenger.removeFromTeamConversations({
          eventId: editionId,
          teamId: affectation.teamId,
          userId: application.userId,
          tx,
        })
      }

      await useVolunteerPorts().messenger.removeFromOrganizersConversation({
        eventId: editionId,
        userId: application.userId,
        tx,
      })

      await tx.editionVolunteerApplication.delete({ where: { id: applicationId } })
    })

    return createSuccessResponse({}, 'Candidature supprimée avec succès')
  },
  { operationName: 'DeleteManualVolunteerApplication' }
)
