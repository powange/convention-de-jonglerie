import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * GET /api/editions/[id]/volunteers/team-organizers
 *
 * Les organisateurs rattachés aux équipes de bénévoles, pour les afficher dans la répartition
 * par équipe aux côtés des bénévoles.
 *
 * Endpoint distinct de `/organizers/edition-organizers`, qui exige le droit sur les
 * organisateurs ou sur la billetterie : un responsable du bénévolat n'a ni l'un ni l'autre, et
 * n'aurait donc rien vu. Ce qu'on lit ici est la composition d'une équipe de bénévolat, la
 * permission qui la commande est celle des bénévoles.
 *
 * Distinct aussi de `/volunteer-teams`, ouvert en lecture publique pour le formulaire de
 * candidature : les noms des organisateurs n'ont rien à y faire.
 *
 * Sans filtre sur le réglage `organizersInTeams` : le refermer masque les rattachements côté
 * interface sans les effacer, et les relire ne divulgue rien à qui gère déjà le bénévolat.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    const rattachements = await prisma.organizerTeamAssignment.findMany({
      where: { team: { eventId: editionId } },
      // Ordre stable : sans tri, l'affichage change d'une requête à l'autre.
      orderBy: { editionOrganizer: { organizer: { user: { nom: 'asc' } } } },
      select: {
        teamId: true,
        editionOrganizer: {
          select: {
            id: true,
            organizer: {
              select: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    prenom: true,
                    nom: true,
                    emailHash: true,
                    profilePicture: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({
      assignments: rattachements.map((rattachement) => ({
        teamId: rattachement.teamId,
        editionOrganizerId: rattachement.editionOrganizer.id,
        user: rattachement.editionOrganizer.organizer.user,
      })),
    })
  },
  { operationName: 'GetVolunteerTeamOrganizers' }
)
