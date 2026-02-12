import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  volunteerApplicationPatchSchema,
  validateAllergiesUpdate,
  buildVolunteerApplicationUpdateData,
  getUserUpdateData,
} from '#server/utils/editions/volunteers/applications'
import {
  NotificationService,
  NotificationHelpers,
  safeNotify,
} from '#server/utils/notification-service'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import {
  compareApplicationChanges,
  hasApplicationDataChanges,
} from '#server/utils/volunteer-application-diff'
import {
  createVolunteerMealSelections,
  deleteVolunteerMealSelections,
} from '#server/utils/volunteer-meals'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const applicationId = validateResourceId(event, 'applicationId', 'candidature')
    const parsed = volunteerApplicationPatchSchema.parse(await readBody(event))

    // Validation des allergies
    const allergiesErrors = validateAllergiesUpdate(parsed)
    if (allergiesErrors.length) {
      throw createError({
        status: 400,
        message: allergiesErrors[0],
      })
    }

    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })

    const application = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        editionId: true,
        status: true,

        // Données personnelles (snapshot)
        userSnapshotPhone: true,

        // Disponibilités
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: true,
        departureDateTime: true,

        // Préférences
        teamPreferences: true,
        timePreferences: true,
        companionName: true,
        avoidList: true,

        // Régime et allergies
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,

        // Informations complémentaires
        hasPets: true,
        petsDetails: true,
        hasMinors: true,
        minorsDetails: true,
        hasVehicle: true,
        vehicleDetails: true,
        skills: true,
        hasExperience: true,
        experienceDetails: true,
        motivation: true,

        user: {
          select: userBasicSelect,
        },
        edition: {
          select: {
            name: true,
            convention: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
    if (!application || application.editionId !== editionId)
      throw createError({ status: 404, message: 'Candidature introuvable' })

    // Si on modifie les données de la candidature (sans changer le statut)
    if (parsed.status === undefined && hasApplicationDataChanges(parsed)) {
      // Si le téléphone est modifié, récupérer les données utilisateur
      let user = null
      if (parsed.phone !== undefined) {
        user = await prisma.user.findUnique({
          where: { id: application.user.id },
          select: { phone: true, nom: true, prenom: true },
        })
        if (!user) throw createError({ status: 404, message: 'Utilisateur introuvable' })
      }

      // Comparer les données avant/après pour détecter les modifications
      const applicationChanges = await compareApplicationChanges(application, parsed)

      const { changes } = applicationChanges

      // Construire les données de mise à jour
      const updateData = buildVolunteerApplicationUpdateData(parsed, user || undefined)

      // Mettre à jour le profil utilisateur si le téléphone a changé
      if (parsed.phone !== undefined && user) {
        const userUpdateData = getUserUpdateData(user, { phone: parsed.phone })
        if (Object.keys(userUpdateData).length) {
          await prisma.user.update({
            where: { id: application.user.id },
            data: userUpdateData,
          })
        }
      }

      const updated = await prisma.editionVolunteerApplication.update({
        where: { id: applicationId },
        data: updateData,
        select: {
          id: true,
          status: true,

          // Données personnelles (snapshot)
          userSnapshotPhone: true,

          // Disponibilités
          setupAvailability: true,
          teardownAvailability: true,
          eventAvailability: true,
          arrivalDateTime: true,
          departureDateTime: true,

          // Préférences
          teamPreferences: true,
          timePreferences: true,
          companionName: true,
          avoidList: true,

          // Régime et allergies
          dietaryPreference: true,
          allergies: true,
          allergySeverity: true,
          emergencyContactName: true,
          emergencyContactPhone: true,

          // Informations complémentaires
          hasPets: true,
          petsDetails: true,
          hasMinors: true,
          minorsDetails: true,
          hasVehicle: true,
          vehicleDetails: true,
          skills: true,
          hasExperience: true,
          experienceDetails: true,
          motivation: true,

          user: {
            select: userBasicSelect,
          },
        },
      })

      // Envoyer une notification au bénévole s'il y a des modifications ou une note
      // MAIS seulement si la modification n'est pas faite par le bénévole lui-même
      const isOwnApplication = application.user.id === user.id
      if (!isOwnApplication && (changes.length > 0 || parsed.modificationNote?.trim())) {
        const displayName = application.edition.name || application.edition.convention.name
        let message = `Votre candidature pour "${displayName}" a été modifiée par les organisateurs`

        if (changes.length > 0) {
          message += `.\n\nModifications :\n• ${changes.join('\n• ')}`
        }

        if (parsed.modificationNote?.trim()) {
          message += `\n\nNote : ${parsed.modificationNote.trim()}`
        }

        await safeNotify(
          () =>
            NotificationService.create({
              userId: application.user.id,
              type: 'INFO',
              titleText: `Modification de votre candidature bénévole`,
              messageText: message,
              category: 'volunteer',
              entityType: 'Edition',
              entityId: editionId.toString(),
              actionUrl: `/my-volunteer-applications`,
              actionText: 'Voir ma candidature',
              notificationType: 'volunteer_application_modified',
            }),
          'modification candidature bénévole'
        )
      }

      return { success: true, application: updated }
    }

    // Sinon, gestion classique du changement de statut
    const target = parsed.status
    if (!target) throw createError({ status: 400, message: 'Statut requis' })

    if (target === application.status)
      throw createError({ status: 400, message: 'Statut identique' })

    // Règles de transition :
    // PENDING -> ACCEPTED/REJECTED (décision)
    // ACCEPTED/REJECTED -> PENDING (annulation)
    // Pas de passage direct ACCEPTED <-> REJECTED sans repasser par PENDING
    if (
      (application.status === 'PENDING' && (target === 'ACCEPTED' || target === 'REJECTED')) ||
      ((application.status === 'ACCEPTED' || application.status === 'REJECTED') &&
        target === 'PENDING')
    ) {
      // ok
    } else {
      throw createError({ status: 400, message: 'Transition interdite' })
    }

    // Mettre à jour le statut et la note d'acceptation
    const updateData: any = {
      status: target,
      decidedAt: target === 'ACCEPTED' || target === 'REJECTED' ? new Date() : null,
    }

    // Ajouter la note d'acceptation si fournie et si on accepte
    if (target === 'ACCEPTED' && parsed.note) {
      updateData.acceptanceNote = parsed.note
    }

    // Si on remet en attente ou on rejette, supprimer les assignations d'équipes, repas et validation d'entrée
    if (target === 'PENDING' || target === 'REJECTED') {
      // Supprimer les relations avec les équipes
      updateData.teamAssignments = {
        deleteMany: {}, // Supprimer toutes les relations avec les équipes
      }
      // Réinitialiser la validation d'entrée
      updateData.entryValidated = false
      updateData.entryValidatedAt = null
      updateData.entryValidatedBy = null
      // Supprimer les sélections de repas
      await deleteVolunteerMealSelections(applicationId)
    }

    const updated = await prisma.editionVolunteerApplication.update({
      where: { id: applicationId },
      data: updateData,
      select: {
        id: true,
        status: true,
        decidedAt: true,
        acceptanceNote: true,
        teamAssignments: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Si on accepte le bénévole, créer automatiquement ses sélections de repas
    if (target === 'ACCEPTED') {
      try {
        await createVolunteerMealSelections(applicationId, editionId)
      } catch (mealError) {
        // Ne pas faire échouer l'acceptation si la création des repas échoue
        console.error('Erreur lors de la création des repas du bénévole:', mealError)
      }
    }

    // Envoyer une notification selon le changement de statut
    const editionName = `${application.edition.convention.name}${application.edition.name ? ' - ' + application.edition.name : ''}`

    if (target === 'ACCEPTED') {
      const assignedTeamNames = updated.teamAssignments.map((ta) => ta.team.name)
      await safeNotify(
        () =>
          NotificationHelpers.volunteerAccepted(
            application.user.id,
            editionName,
            editionId,
            assignedTeamNames,
            updated.acceptanceNote
          ),
        'candidature bénévole acceptée'
      )
    } else if (target === 'REJECTED') {
      await safeNotify(
        () => NotificationHelpers.volunteerRejected(application.user.id, editionName, editionId),
        'candidature bénévole refusée'
      )
    } else if (target === 'PENDING') {
      await safeNotify(
        () =>
          NotificationHelpers.volunteerBackToPending(application.user.id, editionName, editionId),
        'candidature bénévole en attente'
      )
    }

    return { success: true, application: updated }
  },
  { operationName: 'UpdateVolunteerApplication' }
)
