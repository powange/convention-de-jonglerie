import { z } from 'zod'

import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  motivation: z.string().max(1000).optional().nullable(),
  phone: z
    .string()
    .max(30)
    .regex(/^[+0-9 ().-]{6,30}$/)
    .optional(),
  nom: z.string().min(1).max(100).optional(),
  prenom: z.string().min(1).max(100).optional(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().max(500).optional().nullable(),
  timePreferences: z.array(z.string()).max(8).optional(),
  teamPreferences: z.array(z.string()).max(20).optional(),
  hasPets: z.boolean().optional(),
  petsDetails: z.string().max(200).optional().nullable(),
  hasMinors: z.boolean().optional(),
  minorsDetails: z.string().max(200).optional().nullable(),
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
    },
  })
  return { success: true, application }
})
