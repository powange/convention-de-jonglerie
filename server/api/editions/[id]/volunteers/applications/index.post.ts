import { requiresEmergencyContact } from '@@/server/utils/allergy-severity'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  volunteerApplicationBodySchema,
  processPhoneLogic,
  getUserUpdateData,
  validateRequiredFields,
  validateAvailability,
  validateTeamPreferences,
} from '@@/server/utils/editions/volunteers/applications'
import { prisma } from '@@/server/utils/prisma'
import { handleValidationError } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  try {
    const authenticatedUser = requireAuth(event)
    const editionId = parseInt(getRouterParam(event, 'id') || '0')
    if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
    const body = await readBody(event).catch(() => ({}))
    const parsed = volunteerApplicationBodySchema.parse(body || {})

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        volunteersOpen: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskEmergencyContact: true,
        volunteersAskCompanion: true,
        volunteersAskAvoidList: true,
        volunteersAskSkills: true,
        volunteersAskExperience: true,
      },
    })
    if (!edition) throw createError({ statusCode: 404, message: 'Edition introuvable' })
    if (!edition.volunteersOpen)
      throw createError({ statusCode: 400, message: 'Recrutement fermé' })

    // Vérifier candidature existante
    const existing = await prisma.editionVolunteerApplication.findUnique({
      where: { editionId_userId: { editionId, userId: authenticatedUser.id } },
      select: { id: true },
    })
    if (existing) throw createError({ statusCode: 409, message: 'Déjà candidat' })

    // Téléphone requis : si pas déjà défini dans user et pas fourni -> erreur
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      select: { phone: true, nom: true, prenom: true },
    })
    if (!user) throw createError({ statusCode: 401, message: 'Non authentifié' })

    // Validation des champs requis
    const missing = validateRequiredFields(user, parsed, edition)
    if (missing.length) {
      throw createError({
        statusCode: 400,
        message: `${missing.join(', ')} requis${missing.length > 1 ? ' sont' : ' est'}`,
      })
    }

    // Validation des disponibilités
    const availabilityErrors = validateAvailability(parsed)
    if (availabilityErrors.length) {
      throw createError({
        statusCode: 400,
        message: availabilityErrors[0],
      })
    }

    // Validation des préférences d'équipes
    const teamErrors = await validateTeamPreferences(
      parsed,
      editionId,
      edition.volunteersAskTeamPreferences
    )
    if (teamErrors.length) {
      throw createError({
        statusCode: 400,
        message: teamErrors[0],
      })
    }

    // Traitement du téléphone
    const finalPhone = processPhoneLogic(user, parsed)

    // Mettre à jour user si des données manquent
    const updateData = getUserUpdateData(user, parsed)
    if (Object.keys(updateData).length) {
      await prisma.user.update({ where: { id: authenticatedUser.id }, data: updateData })
    }

    const application = await prisma.editionVolunteerApplication.create({
      data: {
        editionId,
        userId: authenticatedUser.id,
        motivation: parsed.motivation || null,
        userSnapshotPhone: finalPhone,
        dietaryPreference:
          edition.volunteersAskDiet && parsed.dietaryPreference ? parsed.dietaryPreference : 'NONE',
        allergies:
          edition.volunteersAskAllergies && parsed.allergies?.trim()
            ? parsed.allergies.trim()
            : null,
        allergySeverity:
          edition.volunteersAskAllergies && parsed.allergies?.trim() && parsed.allergySeverity
            ? parsed.allergySeverity
            : null,
        timePreferences:
          edition.volunteersAskTimePreferences && parsed.timePreferences?.length
            ? parsed.timePreferences
            : null,
        teamPreferences:
          edition.volunteersAskTeamPreferences && parsed.teamPreferences?.length
            ? parsed.teamPreferences
            : null,
        hasPets: edition.volunteersAskPets && parsed.hasPets ? parsed.hasPets : null,
        petsDetails:
          edition.volunteersAskPets && parsed.hasPets && parsed.petsDetails?.trim()
            ? parsed.petsDetails.trim()
            : null,
        hasMinors: edition.volunteersAskMinors && parsed.hasMinors ? parsed.hasMinors : null,
        minorsDetails:
          edition.volunteersAskMinors && parsed.hasMinors && parsed.minorsDetails?.trim()
            ? parsed.minorsDetails.trim()
            : null,
        hasVehicle: edition.volunteersAskVehicle && parsed.hasVehicle ? parsed.hasVehicle : null,
        vehicleDetails:
          edition.volunteersAskVehicle && parsed.hasVehicle && parsed.vehicleDetails?.trim()
            ? parsed.vehicleDetails.trim()
            : null,
        companionName:
          edition.volunteersAskCompanion && parsed.companionName?.trim()
            ? parsed.companionName.trim()
            : null,
        avoidList:
          edition.volunteersAskAvoidList && parsed.avoidList?.trim()
            ? parsed.avoidList.trim()
            : null,
        skills: edition.volunteersAskSkills && parsed.skills?.trim() ? parsed.skills.trim() : null,
        hasExperience:
          edition.volunteersAskExperience && parsed.hasExperience ? parsed.hasExperience : null,
        experienceDetails:
          edition.volunteersAskExperience &&
          parsed.hasExperience &&
          parsed.experienceDetails?.trim()
            ? parsed.experienceDetails.trim()
            : null,
        setupAvailability: parsed.setupAvailability || null,
        teardownAvailability: parsed.teardownAvailability || null,
        eventAvailability: parsed.eventAvailability || null,
        arrivalDateTime: parsed.arrivalDateTime?.trim() ? parsed.arrivalDateTime.trim() : null,
        departureDateTime: parsed.departureDateTime?.trim()
          ? parsed.departureDateTime.trim()
          : null,
        emergencyContactName:
          (edition.volunteersAskEmergencyContact ||
            (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))) &&
          parsed.emergencyContactName?.trim()
            ? parsed.emergencyContactName.trim()
            : null,
        emergencyContactPhone:
          (edition.volunteersAskEmergencyContact ||
            (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))) &&
          parsed.emergencyContactPhone?.trim()
            ? parsed.emergencyContactPhone.trim()
            : null,
      },
      select: {
        id: true,
        status: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        timePreferences: true,
        teamPreferences: true,
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
        setupAvailability: true,
        teardownAvailability: true,
        arrivalDateTime: true,
        departureDateTime: true,
        edition: {
          select: {
            id: true,
            name: true,
            conventionId: true,
            convention: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Envoyer une notification de confirmation de candidature
    try {
      const editionName = `${application.edition.convention.name}${application.edition.name ? ' - ' + application.edition.name : ''}`
      const { NotificationHelpers } = await import('@@/server/utils/notification-service')
      await NotificationHelpers.volunteerApplicationSubmitted(
        authenticatedUser.id,
        editionName,
        editionId
      )
    } catch (notificationError) {
      // Ne pas faire échouer l'application si la notification échoue
      console.error("Erreur lors de l'envoi de la notification:", notificationError)
    }

    return { success: true, application }
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error)
    }

    // Re-lancer les erreurs déjà formatées de createError
    // Vérifier si c'est une erreur avec un statusCode ou un message d'erreur métier
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      const errorMsg = error.message.toLowerCase()
      // Si c'est une erreur métier connue, la relancer
      if (
        'statusCode' in error ||
        'status' in error ||
        errorMsg.includes('déjà candidat') ||
        errorMsg.includes('recrutement fermé') ||
        errorMsg.includes('edition introuvable') ||
        errorMsg.includes('non authentifié') ||
        errorMsg.includes("contact d'urgence") ||
        errorMsg.includes('requis')
      ) {
        throw error
      }
    }

    console.error('Erreur lors de la candidature bénévole:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur interne',
    })
  }
})
