import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { buildUpdateData } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

const bodySchema = z
  .object({
    pagePublic: z.boolean().optional(),
    open: z.boolean().optional(),
    description: z
      .string()
      .max(5000, 'La description ne peut pas dépasser 5000 caractères')
      .optional()
      .nullable(),
    mode: z.enum(['INTERNAL', 'EXTERNAL']).optional(),
    externalUrl: z
      .string()
      .url('URL externe invalide')
      .max(1000, 'URL trop longue (max 1000 caractères)')
      .refine((url) => {
        // Rejeter les URLs vides ou incomplètes
        if (!url || url.trim().length === 0) return false

        // Rejeter les protocoles dangereux
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
        const lowerUrl = url.toLowerCase()
        if (dangerousProtocols.some((protocol) => lowerUrl.startsWith(protocol))) {
          return false
        }

        // Accepter seulement HTTP et HTTPS
        if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
          return false
        }

        // Vérifier que l'URL n'est pas juste le protocole
        if (lowerUrl === 'http://' || lowerUrl === 'https://') {
          return false
        }

        return true
      }, 'URL externe invalide - seuls les liens HTTP/HTTPS sont autorisés')
      .optional()
      .nullable(),
    askDiet: z.boolean().optional(),
    askAllergies: z.boolean().optional(),
    askTimePreferences: z.boolean().optional(),
    askTeamPreferences: z.boolean().optional(),
    askPets: z.boolean().optional(),
    askMinors: z.boolean().optional(),
    askVehicle: z.boolean().optional(),
    askCompanion: z.boolean().optional(),
    askAvoidList: z.boolean().optional(),
    askSkills: z.boolean().optional(),
    askExperience: z.boolean().optional(),
    askEmergencyContact: z.boolean().optional(),
    setupStartDate: z
      .string()
      .datetime('Format de date invalide - utilisez le format ISO 8601')
      .refine((date) => {
        if (!date) return true // null/undefined acceptés
        const parsedDate = new Date(date)
        const now = new Date()
        // Permettre les dates à partir d'hier (pour la flexibilité)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        return parsedDate >= yesterday
      }, 'La date de début de montage ne peut pas être dans le passé')
      .nullable()
      .optional(),
    setupEndDate: z
      .string()
      .datetime('Format de date invalide - utilisez le format ISO 8601')
      .refine((date) => {
        if (!date) return true // null/undefined acceptés
        const parsedDate = new Date(date)
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        return parsedDate >= yesterday
      }, 'La date de fin de montage ne peut pas être dans le passé')
      .nullable()
      .optional(),
    askSetup: z.boolean().optional(),
    askTeardown: z.boolean().optional(),
    teams: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          slots: z.number().int().min(1).max(99).optional(),
        })
      )
      .max(20)
      .optional(),
  })
  .refine(
    (data) => {
      // Validation croisée : date de fin après date de début
      if (data.setupStartDate && data.setupEndDate) {
        const startDate = new Date(data.setupStartDate)
        const endDate = new Date(data.setupEndDate)
        return endDate >= startDate
      }
      return true
    },
    {
      message: 'La date de fin de montage doit être après la date de début',
      path: ['setupEndDate'], // L'erreur sera attachée au champ setupEndDate
    }
  )

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event).catch(() => ({}))

    // Validation avec gestion d'erreur appropriée
    let parsed
    try {
      parsed = bodySchema.parse(body || {})
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    // Permission: auteur convention ou organisateur avec droit gestion bénévoles
    const allowed = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })

    // Étape 0bis : la config bénévole vit dans EventVolunteerSettings (porté par Event).
    const currentSettings = await prisma.eventVolunteerSettings.findUnique({
      where: { eventId: editionId },
      select: { mode: true },
    })

    // Validation spécifique : URL externe requise pour le mode EXTERNAL
    if (parsed.externalUrl !== undefined) {
      if (
        (parsed.mode === 'EXTERNAL' || currentSettings?.mode === 'EXTERNAL') &&
        !parsed.externalUrl
      ) {
        throw createError({
          status: 400,
          message: 'URL externe requise pour le mode EXTERNAL',
        })
      }
    }

    // Champs EventVolunteerSettings (mêmes noms que l'API, sans préfixe volunteers)
    const mappedData = {
      pagePublic: parsed.pagePublic,
      open: parsed.open,
      description: parsed.description || null,
      mode: parsed.mode,
      externalUrl: parsed.externalUrl || null,
      askDiet: parsed.askDiet,
      askAllergies: parsed.askAllergies,
      askTimePreferences: parsed.askTimePreferences,
      askTeamPreferences: parsed.askTeamPreferences,
      askPets: parsed.askPets,
      askMinors: parsed.askMinors,
      askVehicle: parsed.askVehicle,
      askCompanion: parsed.askCompanion,
      askAvoidList: parsed.askAvoidList,
      askSkills: parsed.askSkills,
      askExperience: parsed.askExperience,
      askEmergencyContact: parsed.askEmergencyContact,
      setupStartDate: parsed.setupStartDate,
      teardownEndDate: parsed.setupEndDate,
      askSetup: parsed.askSetup,
      askTeardown: parsed.askTeardown,
    }

    // Construire les données de mise à jour avec buildUpdateData
    const data = buildUpdateData(mappedData, {
      transform: {
        setupStartDate: (val) => (val ? new Date(val) : null),
        teardownEndDate: (val) => (val ? new Date(val) : null),
        description: (val) => val || null,
        externalUrl: (val) => val || null,
      },
    }) as Record<string, unknown>

    if (Object.keys(data).length === 0) return createSuccessResponse({ unchanged: true })
    data.updatedAt = new Date()

    // Upsert : la ligne existe normalement (backfill + création d'édition) ; create défensif.
    const updated = await prisma.eventVolunteerSettings.upsert({
      where: { eventId: editionId },
      update: data,
      create: { eventId: editionId, ...data },
    })
    return createSuccessResponse({ settings: updated })
  },
  { operationName: 'UpdateVolunteerSettings' }
)
