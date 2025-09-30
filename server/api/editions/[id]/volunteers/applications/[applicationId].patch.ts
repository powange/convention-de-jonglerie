import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import {
  volunteerApplicationPatchSchema,
  validateAllergiesUpdate,
  buildUpdateData,
  getUserUpdateData,
} from '../../../../../utils/editions/volunteers/applications'
import { NotificationService } from '../../../../../utils/notification-service'
import { prisma } from '../../../../../utils/prisma'
import {
  compareApplicationChanges,
  hasApplicationDataChanges,
} from '../../../../../utils/volunteer-application-diff'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  const parsed = volunteerApplicationPatchSchema.parse(await readBody(event))

  // Validation des allergies
  const allergiesErrors = validateAllergiesUpdate(parsed)
  if (allergiesErrors.length) {
    throw createError({
      statusCode: 400,
      message: allergiesErrors[0],
    })
  }

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
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
        select: {
          id: true,
          pseudo: true,
          email: true,
        },
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
    throw createError({ statusCode: 404, message: 'Candidature introuvable' })

  // Si on modifie les données de la candidature (sans changer le statut)
  if (parsed.status === undefined && hasApplicationDataChanges(parsed)) {
    // Si le téléphone est modifié, récupérer les données utilisateur
    let user = null
    if (parsed.phone !== undefined) {
      user = await prisma.user.findUnique({
        where: { id: application.user.id },
        select: { phone: true, nom: true, prenom: true },
      })
      if (!user) throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
    }

    // Comparer les données avant/après pour détecter les modifications
    const applicationChanges = await compareApplicationChanges(application, parsed)

    const { changes } = applicationChanges

    // Construire les données de mise à jour
    const updateData = buildUpdateData(parsed, user || undefined)

    // Mettre à jour le profil utilisateur si le téléphone a changé
    if (parsed.phone !== undefined && user) {
      const userUpdateData = getUserUpdateData(user, { phone: parsed.phone })
      if (Object.keys(userUpdateData).length) {
        await prisma.user.update({
          where: { id: application.user.id },
          data: userUpdateData
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
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })

    // Envoyer une notification au bénévole s'il y a des modifications ou une note
    // MAIS seulement si la modification n'est pas faite par le bénévole lui-même
    const isOwnApplication = application.user.id === event.context.user.id
    if (!isOwnApplication && (changes.length > 0 || parsed.modificationNote?.trim())) {
      try {
        const displayName = application.edition.name || application.edition.convention.name
        let message = `Votre candidature pour "${displayName}" a été modifiée par les organisateurs`

        if (changes.length > 0) {
          message += `.\n\nModifications :\n• ${changes.join('\n• ')}`
        }

        if (parsed.modificationNote?.trim()) {
          message += `\n\nNote : ${parsed.modificationNote.trim()}`
        }

        await NotificationService.create({
          userId: application.user.id,
          type: 'INFO',
          title: `Modification de votre candidature bénévole`,
          message,
          category: 'volunteer',
          entityType: 'Edition',
          entityId: editionId.toString(),
          actionUrl: `/my-volunteer-applications`,
          actionText: 'Voir ma candidature',
          notificationType: 'volunteer_application_modified',
        })
      } catch (error) {
        console.error("Erreur lors de l'envoi de la notification:", error)
        // Ne pas faire échouer la mise à jour si la notification échoue
      }
    }

    return { success: true, application: updated }
  }

  // Sinon, gestion classique du changement de statut
  const target = parsed.status
  if (!target) throw createError({ statusCode: 400, message: 'Statut requis' })

  if (target === application.status)
    throw createError({ statusCode: 400, message: 'Statut identique' })

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
    throw createError({ statusCode: 400, message: 'Transition interdite' })
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

  // Si on remet en attente, supprimer toutes les assignations d'équipes
  if (target === 'PENDING') {
    // Supprimer l'ancien système (JSON)
    updateData.assignedTeams = null

    // Supprimer le nouveau système (relations)
    updateData.teams = {
      set: [], // Supprimer toutes les relations avec les équipes
    }
  }

  const updated = await prisma.editionVolunteerApplication.update({
    where: { id: applicationId },
    data: updateData,
    select: {
      id: true,
      status: true,
      decidedAt: true,
      acceptanceNote: true,
      assignedTeams: true,
      teams: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return { success: true, application: updated }
})
