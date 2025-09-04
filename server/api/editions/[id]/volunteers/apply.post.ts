import { z } from 'zod'

import { prisma } from '../../../../utils/prisma'

// Créneaux horaires valides pour les préférences
const VALID_TIME_SLOTS = [
  'early_morning',
  'morning',
  'early_afternoon',
  'late_afternoon',
  'evening',
  'late_evening',
  'night',
] as const

const bodySchema = z.object({
  motivation: z.string().max(2000).optional().nullable(),
  phone: z
    .string()
    .min(6, 'Téléphone trop court')
    .max(30, 'Téléphone trop long')
    .regex(/^[+0-9 ().-]{6,30}$/, 'Format de téléphone invalide')
    .optional(),
  nom: z.string().min(1, 'Nom requis').max(100, 'Nom trop long').optional(),
  prenom: z.string().min(1, 'Prénom requis').max(100, 'Prénom trop long').optional(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().max(500).optional().nullable(),
  timePreferences: z
    .array(
      z.enum(VALID_TIME_SLOTS, {
        errorMap: () => ({ message: 'Créneau horaire invalide' }),
      })
    )
    .max(8, 'Maximum 8 créneaux horaires')
    .refine(
      (arr) => {
        // Vérifier qu'il n'y a pas de doublons
        const uniqueValues = new Set(arr)
        return uniqueValues.size === arr.length
      },
      { message: 'Les créneaux horaires ne doivent pas contenir de doublons' }
    )
    .optional(),
  teamPreferences: z.array(z.string()).max(20).optional(),
  hasPets: z.boolean().optional(),
  petsDetails: z.string().max(200).optional().nullable(),
  hasMinors: z.boolean().optional(),
  minorsDetails: z.string().max(200).optional().nullable(),
  hasVehicle: z.boolean().optional(),
  vehicleDetails: z.string().max(200).optional().nullable(),
  companionName: z.string().max(300).optional().nullable(),
  avoidList: z.string().max(500).optional().nullable(),
  skills: z.string().max(1000).optional().nullable(),
  hasExperience: z.boolean().optional(),
  experienceDetails: z.string().max(500).optional().nullable(),
  setupAvailability: z.boolean().optional(),
  teardownAvailability: z.boolean().optional(),
  eventAvailability: z.boolean().optional(),
  arrivalDateTime: z.string().optional().nullable(),
  departureDateTime: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })
  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body || {})

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
      volunteersTeams: true,
    },
  })
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Edition introuvable' })
  if (!edition.volunteersOpen)
    throw createError({ statusCode: 400, statusMessage: 'Recrutement fermé' })

  // Vérifier candidature existante
  const existing = await prisma.editionVolunteerApplication.findUnique({
    where: { editionId_userId: { editionId, userId: event.context.user.id } },
    select: { id: true },
  })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Déjà candidat' })

  // Téléphone requis : si pas déjà défini dans user et pas fourni -> erreur
  const user = await prisma.user.findUnique({
    where: { id: event.context.user.id },
    select: { phone: true, nom: true, prenom: true },
  })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })

  // Validations cumulées
  const missing: string[] = []
  if (!user.phone && !parsed.phone) missing.push('Téléphone')
  if (!user.nom && !parsed.nom) missing.push('Nom')
  if (!user.prenom && !parsed.prenom) missing.push('Prénom')
  if (missing.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `${missing.join(', ')} requis${missing.length > 1 ? ' sont' : ' est'}`,
    })
  }

  const finalPhone = user.phone || parsed.phone!

  // Validation des disponibilités (au moins une requise)
  const hasAvailability =
    parsed.setupAvailability || parsed.teardownAvailability || parsed.eventAvailability
  if (!hasAvailability) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Au moins une disponibilité est requise',
    })
  }

  // Validation des dates d'arrivée/départ si disponibilité sélectionnée
  if (
    (parsed.setupAvailability || parsed.eventAvailability || parsed.teardownAvailability) &&
    !parsed.arrivalDateTime
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Date d'arrivée requise",
    })
  }

  if ((parsed.eventAvailability || parsed.teardownAvailability) && !parsed.departureDateTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Date de départ requise',
    })
  }

  // Validation des préférences d'équipe (seulement si les équipes sont demandées)
  if (
    edition.volunteersAskTeamPreferences &&
    parsed.teamPreferences &&
    parsed.teamPreferences.length > 0
  ) {
    const validTeamNames = ((edition.volunteersTeams as Array<{ name: string }>) || []).map(
      (team) => team.name
    )
    const invalidTeams = parsed.teamPreferences.filter((team) => !validTeamNames.includes(team))
    if (invalidTeams.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Équipes invalides : ${invalidTeams.join(', ')}. Équipes valides : ${validTeamNames.join(', ')}`,
      })
    }
  }

  // Mettre à jour user si des données manquent
  const updateData: Record<string, any> = {}
  if (!user.phone && parsed.phone) updateData.phone = parsed.phone
  if (!user.nom && parsed.nom) updateData.nom = parsed.nom
  if (!user.prenom && parsed.prenom) updateData.prenom = parsed.prenom
  if (Object.keys(updateData).length) {
    await prisma.user.update({ where: { id: event.context.user.id }, data: updateData })
  }

  const application = await prisma.editionVolunteerApplication.create({
    data: {
      editionId,
      userId: event.context.user.id,
      motivation: parsed.motivation || null,
      userSnapshotPhone: finalPhone,
      dietaryPreference:
        edition.volunteersAskDiet && parsed.dietaryPreference ? parsed.dietaryPreference : 'NONE',
      allergies:
        edition.volunteersAskAllergies && parsed.allergies?.trim() ? parsed.allergies.trim() : null,
      timePreferences:
        edition.volunteersAskTimePreferences && parsed.timePreferences?.length
          ? parsed.timePreferences
          : null,
      teamPreferences:
        (edition as any).volunteersAskTeamPreferences && parsed.teamPreferences?.length
          ? parsed.teamPreferences
          : null,
      hasPets: (edition as any).volunteersAskPets && parsed.hasPets ? parsed.hasPets : null,
      petsDetails:
        (edition as any).volunteersAskPets && parsed.hasPets && parsed.petsDetails?.trim()
          ? parsed.petsDetails.trim()
          : null,
      hasMinors: (edition as any).volunteersAskMinors && parsed.hasMinors ? parsed.hasMinors : null,
      minorsDetails:
        (edition as any).volunteersAskMinors && parsed.hasMinors && parsed.minorsDetails?.trim()
          ? parsed.minorsDetails.trim()
          : null,
      hasVehicle:
        (edition as any).volunteersAskVehicle && parsed.hasVehicle ? parsed.hasVehicle : null,
      vehicleDetails:
        (edition as any).volunteersAskVehicle && parsed.hasVehicle && parsed.vehicleDetails?.trim()
          ? parsed.vehicleDetails.trim()
          : null,
      companionName:
        (edition as any).volunteersAskCompanion && parsed.companionName?.trim()
          ? parsed.companionName.trim()
          : null,
      avoidList:
        (edition as any).volunteersAskAvoidList && parsed.avoidList?.trim()
          ? parsed.avoidList.trim()
          : null,
      skills:
        (edition as any).volunteersAskSkills && parsed.skills?.trim() ? parsed.skills.trim() : null,
      hasExperience:
        (edition as any).volunteersAskExperience && parsed.hasExperience
          ? parsed.hasExperience
          : null,
      experienceDetails:
        (edition as any).volunteersAskExperience &&
        parsed.hasExperience &&
        parsed.experienceDetails?.trim()
          ? parsed.experienceDetails.trim()
          : null,
      setupAvailability: parsed.setupAvailability || null,
      teardownAvailability: parsed.teardownAvailability || null,
      eventAvailability: parsed.eventAvailability || null,
      arrivalDateTime: parsed.arrivalDateTime?.trim() ? parsed.arrivalDateTime.trim() : null,
      departureDateTime: parsed.departureDateTime?.trim() ? parsed.departureDateTime.trim() : null,
    },
    select: {
      id: true,
      status: true,
      dietaryPreference: true,
      allergies: true,
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
    },
  })
  return { success: true, application }
})
