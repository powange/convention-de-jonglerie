import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import { NotificationService } from '../../../../../utils/notification-service'
import { prisma } from '../../../../../utils/prisma'
import {
  compareApplicationChanges,
  hasApplicationDataChanges,
} from '../../../../../utils/volunteer-application-diff'

// Autorise aussi le retour à PENDING
const bodySchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'PENDING']).optional(),
  teams: z.array(z.string()).optional(), // IDs des équipes pour l'assignation
  note: z.string().optional(), // Note optionnelle pour l'acceptation

  // Disponibilités
  setupAvailability: z.boolean().optional(),
  teardownAvailability: z.boolean().optional(),
  eventAvailability: z.boolean().optional(),
  arrivalDateTime: z.string().optional(),
  departureDateTime: z.string().optional(),

  // Préférences
  teamPreferences: z.array(z.string()).optional(),
  timePreferences: z.array(z.string()).optional(),
  companionName: z.string().optional(),
  avoidList: z.string().optional(),

  // Régime et allergies
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().optional(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),

  // Informations complémentaires
  hasPets: z.boolean().optional(),
  petsDetails: z.string().optional(),
  hasMinors: z.boolean().optional(),
  minorsDetails: z.string().optional(),
  hasVehicle: z.boolean().optional(),
  vehicleDetails: z.string().optional(),
  skills: z.string().optional(),
  hasExperience: z.boolean().optional(),
  experienceDetails: z.string().optional(),
  motivation: z.string().optional(),

  // Note de modification
  modificationNote: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  const parsed = bodySchema.parse(await readBody(event))

  // Validation: si allergies renseignées, le niveau de sévérité est requis
  if (parsed.allergies?.trim() && !parsed.allergySeverity) {
    throw createError({
      statusCode: 400,
      message: 'Niveau de sévérité des allergies requis',
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
    // Comparer les données avant/après pour détecter les modifications
    const applicationChanges = await compareApplicationChanges(application, parsed)

    const { changes } = applicationChanges

    // Mise à jour de tous les champs modifiés
    const updateData: any = {}

    // Disponibilités
    if (parsed.setupAvailability !== undefined)
      updateData.setupAvailability = parsed.setupAvailability
    if (parsed.teardownAvailability !== undefined)
      updateData.teardownAvailability = parsed.teardownAvailability
    if (parsed.eventAvailability !== undefined)
      updateData.eventAvailability = parsed.eventAvailability
    if (parsed.arrivalDateTime !== undefined)
      updateData.arrivalDateTime = parsed.arrivalDateTime || null
    if (parsed.departureDateTime !== undefined)
      updateData.departureDateTime = parsed.departureDateTime || null

    // Préférences
    if (parsed.teamPreferences !== undefined) updateData.teamPreferences = parsed.teamPreferences
    if (parsed.timePreferences !== undefined) updateData.timePreferences = parsed.timePreferences
    if (parsed.companionName !== undefined)
      updateData.companionName = parsed.companionName.trim() || null
    if (parsed.avoidList !== undefined) updateData.avoidList = parsed.avoidList.trim() || null

    // Régime et allergies
    if (parsed.dietaryPreference !== undefined)
      updateData.dietaryPreference = parsed.dietaryPreference
    if (parsed.allergies !== undefined) updateData.allergies = parsed.allergies.trim() || null
    if (parsed.allergySeverity !== undefined)
      updateData.allergySeverity = parsed.allergies?.trim() ? parsed.allergySeverity : null
    if (parsed.emergencyContactName !== undefined)
      updateData.emergencyContactName = parsed.emergencyContactName.trim() || null
    if (parsed.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = parsed.emergencyContactPhone.trim() || null

    // Informations complémentaires
    if (parsed.hasPets !== undefined) updateData.hasPets = parsed.hasPets
    if (parsed.petsDetails !== undefined) updateData.petsDetails = parsed.petsDetails.trim() || null
    if (parsed.hasMinors !== undefined) updateData.hasMinors = parsed.hasMinors
    if (parsed.minorsDetails !== undefined)
      updateData.minorsDetails = parsed.minorsDetails.trim() || null
    if (parsed.hasVehicle !== undefined) updateData.hasVehicle = parsed.hasVehicle
    if (parsed.vehicleDetails !== undefined)
      updateData.vehicleDetails = parsed.vehicleDetails.trim() || null
    if (parsed.skills !== undefined) updateData.skills = parsed.skills.trim() || null
    if (parsed.hasExperience !== undefined) updateData.hasExperience = parsed.hasExperience
    if (parsed.experienceDetails !== undefined)
      updateData.experienceDetails = parsed.experienceDetails.trim() || null
    if (parsed.motivation !== undefined) updateData.motivation = parsed.motivation.trim() || null

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
