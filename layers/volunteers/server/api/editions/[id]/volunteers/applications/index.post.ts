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
import { infosPersonnellesSelect } from '#server/utils/infos-personnelles'
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
      // Les infos personnelles sont chargées pour savoir lesquelles manquent au profil :
      // `getUserUpdateData` n'y remonte que ce qui y fait défaut.
      select: { phone: true, nom: true, prenom: true, ...infosPersonnellesSelect },
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

    // Ce que l'édition ne demande pas n'est pas enregistré, pas même sur le profil. L'ancienne
    // écriture sur la candidature appliquait déjà ce filtre ; le perdre en passant au profil
    // aurait permis d'y déposer des informations qu'aucun formulaire n'avait montrées.
    const contactUrgenceDemande = Boolean(
      settings.askEmergencyContact ||
      (parsed.allergySeverity && requiresEmergencyContact(parsed.allergySeverity))
    )
    const saisieRetenue = {
      ...parsed,
      dietaryPreference: settings.askDiet ? parsed.dietaryPreference : undefined,
      allergies: settings.askAllergies ? parsed.allergies : undefined,
      allergySeverity: settings.askAllergies ? parsed.allergySeverity : undefined,
      emergencyContactName: contactUrgenceDemande ? parsed.emergencyContactName : undefined,
      emergencyContactPhone: contactUrgenceDemande ? parsed.emergencyContactPhone : undefined,
    }

    // Mettre à jour user si des données manquent
    const updateData = getUserUpdateData(user, saisieRetenue)
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
        // Régime, allergies et contact d'urgence ne sont pas écrits ici : ils vivent sur le
        // profil, où `getUserUpdateData` les a portés juste au-dessus.
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
        // `??` et non `||` : un refus explicite est une réponse, et doit s'enregistrer comme
        // telle. Avec `||`, un « non » devenait indistinguable d'une question restée sans
        // réponse — et le formulaire de modification le réaffichait ensuite comme un « oui ».
        setupAvailability: parsed.setupAvailability ?? null,
        teardownAvailability: parsed.teardownAvailability ?? null,
        eventAvailability: parsed.eventAvailability ?? null,
        arrivalDateTime: sanitizeString(parsed.arrivalDateTime),
        departureDateTime: sanitizeString(parsed.departureDateTime),
      },
      select: {
        id: true,
        status: true,
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

    // Prévenir le candidat, puis les organisateurs qui gèrent les bénévoles.
    // Une candidature nouvelle n'étant rattachée à aucune équipe, les responsables d'équipe
    // n'ont pas de lien avec elle : ce sont les organisateurs habilités qui la traiteront.
    try {
      const editionName = application.event.name ?? ''
      const { NotificationHelpers } = await import('#server/utils/notification-service')
      const { listerGestionnairesBenevoles } = await import('#server/utils/organizer-management')

      await NotificationHelpers.volunteerApplicationSubmitted(
        authenticatedUser.id,
        editionName,
        editionId
      )

      const gestionnaires = await listerGestionnairesBenevoles(editionId)
      // `authenticatedUser` ne porte que l'identité de session (id, email, pseudo) ;
      // le nom et le prénom viennent de l'utilisateur chargé plus haut.
      const candidat =
        authenticatedUser.pseudo || [user.prenom, user.nom].filter(Boolean).join(' ') || ''

      await Promise.all(
        gestionnaires
          // Un organisateur qui postule comme bénévole a déjà sa confirmation d'envoi :
          // lui annoncer sa propre candidature n'apprendrait rien.
          .filter((userId) => userId !== authenticatedUser.id)
          .map((userId) =>
            NotificationHelpers.volunteerApplicationReceived(
              userId,
              editionName,
              editionId,
              candidat
            )
          )
      )
    } catch (notificationError) {
      // Ne pas faire échouer l'application si la notification échoue
      console.error("Erreur lors de l'envoi de la notification:", notificationError)
    }

    return createSuccessResponse({ application })
  },
  { operationName: 'CreateVolunteerApplication' }
)
