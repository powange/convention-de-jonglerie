import { requiresEmergencyContact } from '@@/server/utils/allergy-severity'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  volunteerApplicationBodySchema,
  processPhoneLogic,
  getUserUpdateData,
  validateRequiredFields,
  validateAvailability,
  validateTeamPreferences,
} from '@@/server/utils/editions/volunteers/applications'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { generateVolunteerQrCodeToken } from '@@/server/utils/token-generator'
import { sanitizeString, validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const authenticatedUser = requireAuth(event)
    const editionId = validateEditionId(event)
    const body = await readBody(event).catch(() => ({}))
    const parsed = volunteerApplicationBodySchema.parse(body || {})

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
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
      errorMessage: 'Edition introuvable',
    })
    if (!edition.volunteersOpen) throw createError({ status: 400, message: 'Recrutement fermé' })

    // Vérifier candidature existante
    const existing = await prisma.editionVolunteerApplication.findUnique({
      where: { editionId_userId: { editionId, userId: authenticatedUser.id } },
      select: { id: true },
    })
    if (existing) throw createError({ status: 409, message: 'Déjà candidat' })

    // Téléphone requis : si pas déjà défini dans user et pas fourni -> erreur
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      select: { phone: true, nom: true, prenom: true },
    })
    if (!user) throw createError({ status: 401, message: 'Non authentifié' })

    // Validation des champs requis
    const missing = validateRequiredFields(user, parsed, edition)
    if (missing.length) {
      throw createError({
        status: 400,
        message: `${missing.join(', ')} requis${missing.length > 1 ? ' sont' : ' est'}`,
      })
    }

    // Validation des disponibilités
    const availabilityErrors = validateAvailability(parsed)
    if (availabilityErrors.length) {
      throw createError({
        status: 400,
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
        status: 400,
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

    // Générer un token unique
    let qrCodeToken = generateVolunteerQrCodeToken()
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    while (!isUnique && attempts < maxAttempts) {
      const existingToken = await prisma.editionVolunteerApplication.findUnique({
        where: { qrCodeToken },
      })

      if (!existingToken) {
        isUnique = true
      } else {
        qrCodeToken = generateVolunteerQrCodeToken()
        attempts++
      }
    }

    if (!isUnique) {
      throw createError({
        status: 500,
        message: 'Impossible de générer un token unique',
      })
    }

    const application = await prisma.editionVolunteerApplication.create({
      data: {
        editionId,
        userId: authenticatedUser.id,
        motivation: parsed.motivation || null,
        userSnapshotPhone: finalPhone,
        qrCodeToken,
        dietaryPreference:
          edition.volunteersAskDiet && parsed.dietaryPreference ? parsed.dietaryPreference : 'NONE',
        allergies: edition.volunteersAskAllergies ? sanitizeString(parsed.allergies) : null,
        allergySeverity:
          edition.volunteersAskAllergies &&
          sanitizeString(parsed.allergies) &&
          parsed.allergySeverity
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
          edition.volunteersAskPets && parsed.hasPets ? sanitizeString(parsed.petsDetails) : null,
        hasMinors: edition.volunteersAskMinors && parsed.hasMinors ? parsed.hasMinors : null,
        minorsDetails:
          edition.volunteersAskMinors && parsed.hasMinors
            ? sanitizeString(parsed.minorsDetails)
            : null,
        hasVehicle: edition.volunteersAskVehicle && parsed.hasVehicle ? parsed.hasVehicle : null,
        vehicleDetails:
          edition.volunteersAskVehicle && parsed.hasVehicle
            ? sanitizeString(parsed.vehicleDetails)
            : null,
        companionName: edition.volunteersAskCompanion ? sanitizeString(parsed.companionName) : null,
        avoidList: edition.volunteersAskAvoidList ? sanitizeString(parsed.avoidList) : null,
        skills: edition.volunteersAskSkills ? sanitizeString(parsed.skills) : null,
        hasExperience:
          edition.volunteersAskExperience && parsed.hasExperience ? parsed.hasExperience : null,
        experienceDetails:
          edition.volunteersAskExperience && parsed.hasExperience
            ? sanitizeString(parsed.experienceDetails)
            : null,
        setupAvailability: parsed.setupAvailability || null,
        teardownAvailability: parsed.teardownAvailability || null,
        eventAvailability: parsed.eventAvailability || null,
        arrivalDateTime: sanitizeString(parsed.arrivalDateTime),
        departureDateTime: sanitizeString(parsed.departureDateTime),
        emergencyContactName:
          edition.volunteersAskEmergencyContact ||
          (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))
            ? sanitizeString(parsed.emergencyContactName)
            : null,
        emergencyContactPhone:
          edition.volunteersAskEmergencyContact ||
          (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))
            ? sanitizeString(parsed.emergencyContactPhone)
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

    return {
      success: true,
      application,
    }
  },
  { operationName: 'CreateVolunteerApplication' }
)
