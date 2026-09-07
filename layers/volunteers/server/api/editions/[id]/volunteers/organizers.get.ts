import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * GET /api/editions/[id]/volunteers/organizers
 *
 * Les organisateurs de l'édition, avec les équipes de bénévoles auxquelles ils sont rattachés.
 * Sert à deux écrans : la répartition par équipe, qui les affiche aux côtés des bénévoles, et
 * l'affectation à un créneau, qui a besoin de la liste des candidats.
 *
 * Endpoint distinct de `/organizers/edition-organizers`, qui exige le droit sur les
 * organisateurs ou sur la billetterie : un responsable du bénévolat n'a ni l'un ni l'autre, et
 * n'aurait donc rien vu. Ce qu'on lit ici relève du bénévolat, et c'est sa permission qui
 * commande.
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

    const organisateurs = await prisma.editionOrganizer.findMany({
      where: { editionId },
      // Ordre stable : sans tri, l'affichage change d'une requête à l'autre.
      orderBy: { organizer: { user: { nom: 'asc' } } },
      select: {
        id: true,
        teamAssignments: { select: { teamId: true } },
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
                updatedAt: true,
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({
      organizers: organisateurs.map((organisateur) => ({
        editionOrganizerId: organisateur.id,
        user: organisateur.organizer.user,
        teamIds: organisateur.teamAssignments.map((rattachement) => rattachement.teamId),
      })),
    })
  },
  { operationName: 'GetVolunteerOrganizers' }
)
