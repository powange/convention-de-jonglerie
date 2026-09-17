import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Les organisateurs d'une édition et leurs équipes de bénévolat.
 *
 * Rattacher un organisateur à une équipe est une décision de BÉNÉVOLAT : l'écriture l'a toujours
 * dit — elle exige `canManageEditionVolunteers` — mais le seul écran qui l'offrait vivait sur la
 * page des organisateurs, fermée à ce droit. Qui pouvait faire l'association ne pouvait pas y
 * accéder ; qui pouvait y accéder n'avait pas le droit de la faire.
 *
 * D'où ce point d'API plutôt que l'ouverture de `edition-organizers.get`, qui rend les droits de
 * chacun, leurs adresses et leurs repas : un gestionnaire des bénévoles n'a besoin que de trois
 * choses — qui est là, sous quel nom, dans quelles équipes.
 *
 * ⚠️ Ne rend NI adresse, NI téléphone, NI droit. Ajouter un champ ici revient à élargir ce qu'un
 * droit de bénévolat donne à voir des organisateurs : la sélection est la garde.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles de cette édition',
      })
    }

    const organisateurs = await prisma.editionOrganizer.findMany({
      where: { editionId },
      select: {
        id: true,
        organizer: {
          select: {
            user: { select: { id: true, pseudo: true, prenom: true, nom: true } },
          },
        },
        teamAssignments: {
          select: { isLeader: true, team: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    // Aplati comme la page des organisateurs le rend déjà, pour que la modale de rattachement —
    // partagée entre les deux écrans — n'ait pas deux formes à connaître.
    return organisateurs
      .map((editionOrganizer) => ({
        id: editionOrganizer.id,
        user: editionOrganizer.organizer.user,
        teams: editionOrganizer.teamAssignments.map((assignation) => ({
          ...assignation.team,
          isLeader: assignation.isLeader,
        })),
      }))
      .sort((a, b) => nomAffiche(a.user).localeCompare(nomAffiche(b.user), 'fr'))
  },
  { operationName: 'GetVolunteerOrganizers' }
)

/** Le nom sous lequel l'écran affiche quelqu'un, et donc celui par lequel on trie. */
function nomAffiche(user: { pseudo: string | null; prenom: string | null; nom: string | null }) {
  return [user.prenom, user.nom].filter(Boolean).join(' ') || user.pseudo || ''
}
