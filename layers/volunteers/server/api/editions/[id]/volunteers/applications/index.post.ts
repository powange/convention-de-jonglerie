import { requiresEmergencyContact } from '#server/utils/allergy-severity'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  volunteerApplicationBodySchema,
  processPhoneLogic,
  getUserUpdateData,
  validateRequiredFields,
  validateAvailability,
  validateTeamPreferences,
} from '#server/utils/editions/volunteers/applications'
import { generateVolunteerQrCodeToken } from '#server/utils/token-generator'
import { sanitizeString, validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const authenticatedUser = requireAuth(event)
    const editionId = validateEditionId(event)
    const body = await readBody(event).catch(() => ({}))
    const parsed = volunteerApplicationBodySchema.parse(body || {})

    // Étape 0bis : config bénévole portée par EventVolunteerSettings
    const settings = await prisma.eventVolunteerSettings.findUnique({
      where: { eventId: editionId },
      select: {
        open: true,
        askDiet: true,
        askAllergies: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        askPets: true,
        askMinors: true,
        askVehicle: true,
        askEmergencyContact: true,
        askCompanion: true,
        askAvoidList: true,
        askSkills: true,
        askExperience: true,
      },
    })
    if (!settings?.open) throw createError({ status: 400, message: 'Recrutement fermé' })

    // Vérifier candidature existante
    const existing = await prisma.editionVolunteerApplication.findUnique({
      where: { eventId_userId: { eventId: editionId, userId: authenticatedUser.id } },
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
    const missing = validateRequiredFields(user, parsed, settings)
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
    const teamErrors = await validateTeamPreferences(parsed, editionId, settings.askTeamPreferences)
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
        eventId: editionId,
        userId: authenticatedUser.id,
        motivation: parsed.motivation || null,
        userSnapshotPhone: finalPhone,
        qrCodeToken,
        dietaryPreference:
          settings.askDiet && parsed.dietaryPreference ? parsed.dietaryPreference : 'NONE',
        allergies: settings.askAllergies ? sanitizeString(parsed.allergies) : null,
        allergySeverity:
          settings.askAllergies && sanitizeString(parsed.allergies) && parsed.allergySeverity
            ? parsed.allergySeverity
            : null,
        timePreferences:
          settings.askTimePreferences && parsed.timePreferences?.length
            ? parsed.timePreferences
            : null,
        teamPreferences:
          settings.askTeamPreferences && parsed.teamPreferences?.length
            ? parsed.teamPreferences
            : null,
        hasPets: settings.askPets && parsed.hasPets ? parsed.hasPets : null,
        petsDetails: settings.askPets && parsed.hasPets ? sanitizeString(parsed.petsDetails) : null,
        hasMinors: settings.askMinors && parsed.hasMinors ? parsed.hasMinors : null,
        minorsDetails:
          settings.askMinors && parsed.hasMinors ? sanitizeString(parsed.minorsDetails) : null,
        hasVehicle: settings.askVehicle && parsed.hasVehicle ? parsed.hasVehicle : null,
        vehicleDetails:
          settings.askVehicle && parsed.hasVehicle ? sanitizeString(parsed.vehicleDetails) : null,
        companionName: settings.askCompanion ? sanitizeString(parsed.companionName) : null,
        avoidList: settings.askAvoidList ? sanitizeString(parsed.avoidList) : null,
        skills: settings.askSkills ? sanitizeString(parsed.skills) : null,
        hasExperience: settings.askExperience && parsed.hasExperience ? parsed.hasExperience : null,
        experienceDetails:
          settings.askExperience && parsed.hasExperience
            ? sanitizeString(parsed.experienceDetails)
            : null,
        setupAvailability: parsed.setupAvailability || null,
        teardownAvailability: parsed.teardownAvailability || null,
        eventAvailability: parsed.eventAvailability || null,
        arrivalDateTime: sanitizeString(parsed.arrivalDateTime),
        departureDateTime: sanitizeString(parsed.departureDateTime),
        emergencyContactName:
          settings.askEmergencyContact ||
          (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))
            ? sanitizeString(parsed.emergencyContactName)
            : null,
        emergencyContactPhone:
          settings.askEmergencyContact ||
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
        event: {
          select: { name: true },
        },
      },
    })

    // Envoyer une notification de confirmation de candidature
    try {
      const editionName = application.event.name ?? ''
      const { NotificationHelpers } = await import('#server/utils/notification-service')
      await NotificationHelpers.volunteerApplicationSubmitted(
        authenticatedUser.id,
        editionName,
        editionId
      )
    } catch (notificationError) {
      // Ne pas faire échouer l'application si la notification échoue
      console.error("Erreur lors de l'envoi de la notification:", notificationError)
    }

    return createSuccessResponse({ application })
  },
  { operationName: 'CreateVolunteerApplication' }
)
