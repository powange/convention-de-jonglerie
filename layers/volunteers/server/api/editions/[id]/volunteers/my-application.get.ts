import { avecCoequipiers, coequipiersSelect } from '../../../../utils/coequipiers-creneau'
import { planningVisibleSurLEdition } from '../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { infosPersonnelles, infosPersonnellesSelect } from '#server/utils/infos-personnelles'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { estHorsDesComptes, estReserve } from '~~/shared/utils/benevoles-volants'

/**
 * Récupère la candidature de bénévolat de l'utilisateur connecté pour une édition
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer la candidature de l'utilisateur pour cette édition
    const application = await prisma.editionVolunteerApplication.findUnique({
      where: {
        eventId_userId: {
          eventId: editionId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        status: true,
        motivation: true,
        createdAt: true,
        updatedAt: true,
        decidedAt: true,
        timePreferences: true,
        teamPreferences: true,
        acceptanceNote: true,
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: true,
        departureDateTime: true,
        hasPets: true,
        petsDetails: true,
        hasMinors: true,
        minorsDetails: true,
        hasVehicle: true,
        vehicleDetails: true,
        companionName: true,
        avoidList: true,
        skills: true,
        hasExperience: true,
        experienceDetails: true,
        userSnapshotPhone: true,
        user: {
          select: {
            ...userWithNameSelect,
            ...infosPersonnellesSelect,
            email: true,
            phone: true,
          },
        },
        teamAssignments: {
          select: {
            teamId: true,
            isLeader: true,
            assignedAt: true,
            team: {
              select: {
                id: true,
                name: true,
                description: true,
                color: true,
                isFloatingTeam: true,
                isAutonomousTeam: true,
              },
            },
          },
          orderBy: {
            assignedAt: 'asc',
          },
        },
      },
    })

    // Retourner null si pas de candidature (pas d'erreur 404)
    if (!application) {
      return null
    }

    // Le planning doit être publié, en plus d'être accepté.
    //
    // `teamAssignments` est masqué avec les créneaux, et c'est délibéré : savoir qu'on est placé
    // dans « Bar - nuit » est déjà un résultat du travail de planification, au même titre que
    // l'horaire. Les montrer séparément laisserait deviner la moitié de ce qu'on cache.
    //
    // On ne demande pas ici si la personne est gestionnaire : cet endpoint rend SA candidature.
    // Un gestionnaire qui consulte la sienne est d'abord un candidat ; s'il veut voir le planning
    // en construction, c'est par son écran de gestion qu'il passe.
    const planningVisible = await planningVisibleSurLEdition(editionId, false)

    // Récupérer les créneaux assignés si la candidature est acceptée
    let assignedTimeSlots = []
    if (application.status === 'ACCEPTED' && planningVisible) {
      assignedTimeSlots = await prisma.volunteerAssignment.findMany({
        where: {
          userId: user.id,
          timeSlot: {
            eventId: editionId,
          },
        },
        select: {
          id: true,
          assignedAt: true,
          timeSlot: {
            select: {
              id: true,
              title: true,
              startDateTime: true,
              endDateTime: true,
              delayMinutes: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              assignments: coequipiersSelect(user.id),
            },
          },
        },
        orderBy: {
          timeSlot: {
            startDateTime: 'asc',
          },
        },
      })
    }

    return {
      ...application,
      // Le profil fait foi, ici comme dans la vue des organisateurs. Sans cette résolution,
      // l'intéressé relirait la copie figée dans sa candidature pendant que les organisateurs,
      // eux, verraient son profil à jour — deux vérités pour la même personne.
      ...infosPersonnelles(application.user as never),
      teamAssignments: planningVisible ? application.teamAssignments : [],
      /**
       * Le rôle de volant, rendu MÊME quand le planning est masqué.
       *
       * Les équipes, elles, restent cachées jusqu'à publication : savoir qu'on est dans « Bar -
       * nuit » est déjà un résultat de planification. Le rôle de volant n'en est pas un — c'est une
       * décision prise en amont, et celui qui l'ignore attend des créneaux qui ne viendront jamais.
       *
       * Un booléen et non la liste des équipes : on dit le rôle sans dévoiler où la personne est
       * placée, ce que le masquage protège.
       */
      estVolant: estHorsDesComptes(
        application.teamAssignments.map((assignation) => assignation.team)
      ),
      /**
       * Réservé à une équipe autonome, rendu dans les mêmes conditions et pour la même raison.
       *
       * Son planning peut rester vide longtemps : ses créneaux se décident dans son équipe, hors
       * de l'outil. Sans ce drapeau, il attendrait une affectation qui ne viendra pas d'ici.
       */
      estReserve: estReserve(application.teamAssignments.map((assignation) => assignation.team)),
      assignedTimeSlots: assignedTimeSlots.map((assignation) => ({
        ...assignation,
        timeSlot: avecCoequipiers(assignation.timeSlot),
      })),
      // Dit à l'écran POURQUOI il n'a rien à afficher. Sans ce drapeau, un bénévole accepté
      // arrive sur une page vide et conclut à une erreur — ou pire, qu'on l'a désaffecté.
      planningPublished: planningVisible,
    }
  },
  { operationName: 'GetMyVolunteerApplication' }
)
