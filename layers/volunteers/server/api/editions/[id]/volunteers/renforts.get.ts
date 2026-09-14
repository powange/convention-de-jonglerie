import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { estHorsDesComptes } from '~~/shared/utils/benevoles-volants'

/**
 * GET /api/editions/[id]/volunteers/renforts
 *
 * Les bénévoles volants de l'édition, avec de quoi savoir qui est mobilisable.
 *
 * Répond à la question du samedi 18 h — « une équipe est débordée, qui puis-je appeler ? » —, que
 * la seule notion de volant ne suffisait pas à trancher : encore faut-il savoir qui est arrivé et
 * qui est déjà pris.
 *
 * ⚠️ On rend les FAITS, pas leur lecture : l'entrée validée et les créneaux tenus, à charge pour
 * l'écran d'en déduire qui est disponible. Deux raisons. L'état dépend de l'instant, et un état
 * calculé ici serait périmé à l'affichage puis figé jusqu'au prochain appel — alors que l'écran,
 * lui, se met à jour tout seul au fil des minutes. Et la règle vit déjà dans
 * `disponibilite-volants`, éprouvée&nbsp;; la refaire ici la ferait diverger. Même choix que pour
 * les emprunts de matériel.
 *
 * Accessible à qui gère les bénévoles ET aux responsables d'équipe : c'est le responsable débordé
 * qui cherche du renfort, et l'envoyer demander à quelqu'un d'autre ferait perdre les minutes que
 * cet écran existe pour gagner.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const peutGerer = await canManageEditionVolunteers(editionId, user.id, event)
    if (!peutGerer) {
      const equipesResponsable = await equipesDontIlEstResponsable(editionId, user.id)
      if (equipesResponsable.length === 0) {
        throw createError({ status: 403, message: 'Droits insuffisants' })
      }
    }

    const candidatures = await prisma.editionVolunteerApplication.findMany({
      where: {
        eventId: editionId,
        status: 'ACCEPTED',
        // Un premier tri en base : seuls ceux qui ont au moins une équipe volante peuvent être
        // hors des comptes. La règle exacte — TOUTES leurs équipes volantes — se vérifie ensuite,
        // parce qu'elle porte sur l'ensemble des équipes et non sur l'existence de l'une d'elles.
        teamAssignments: { some: { team: { isFloatingTeam: true } } },
      },
      select: {
        id: true,
        userId: true,
        entryValidated: true,
        userSnapshotPhone: true,
        user: { select: { ...userWithNameSelect.select, phone: true } },
        teamAssignments: {
          select: {
            team: { select: { id: true, name: true, color: true, isFloatingTeam: true } },
          },
        },
      },
    })

    const volants = candidatures.filter((candidature) =>
      estHorsDesComptes(candidature.teamAssignments.map((assignation) => assignation.team))
    )

    // Les créneaux que ces volants tiennent, en une requête plutôt qu'une par personne.
    const affectations = volants.length
      ? await prisma.volunteerAssignment.findMany({
          where: {
            userId: { in: volants.map((volant) => volant.userId) },
            timeSlot: { eventId: editionId },
          },
          select: {
            userId: true,
            timeSlot: {
              select: {
                id: true,
                title: true,
                startDateTime: true,
                endDateTime: true,
                team: { select: { id: true, name: true, color: true } },
              },
            },
          },
          orderBy: { timeSlot: { startDateTime: 'asc' } },
        })
      : []

    const creneauxParPersonne = new Map<number, typeof affectations>()
    for (const affectation of affectations) {
      const liste = creneauxParPersonne.get(affectation.userId) ?? []
      liste.push(affectation)
      creneauxParPersonne.set(affectation.userId, liste)
    }

    return createSuccessResponse({
      renforts: volants.map((volant) => ({
        id: volant.id,
        user: volant.user,
        // Le numéro du profil d'abord : c'est celui qu'on compose. La copie figée dans la
        // candidature prend le relais quand le profil n'en porte pas.
        phone: volant.user?.phone || volant.userSnapshotPhone || null,
        entreeValidee: volant.entryValidated,
        equipes: volant.teamAssignments.map((assignation) => assignation.team),
        creneaux: (creneauxParPersonne.get(volant.userId) ?? []).map((affectation) => ({
          debut: affectation.timeSlot.startDateTime,
          fin: affectation.timeSlot.endDateTime,
          titre: affectation.timeSlot.title,
          equipe: affectation.timeSlot.team,
        })),
      })),
    })
  },
  { operationName: 'GetVolunteerRenforts' }
)
