import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { buildUpdateData, fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { handleValidationError } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

import type { EditionUpdateInput } from '@@/server/types/prisma-helpers'

const bodySchema = z
  .object({
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
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: { conventionId: true, volunteersMode: true },
    })
    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })

    // Validation spécifique : URL externe requise pour le mode EXTERNAL
    if (parsed.externalUrl !== undefined) {
      if (
        (parsed.mode === 'EXTERNAL' || edition?.volunteersMode === 'EXTERNAL') &&
        !parsed.externalUrl
      ) {
        throw createError({
          statusCode: 400,
          message: 'URL externe requise pour le mode EXTERNAL',
        })
      }
    }

    // Mapper les champs de l'API vers les champs de la BDD
    const mappedData = {
      volunteersOpen: parsed.open,
      volunteersDescription: parsed.description || null,
      volunteersMode: parsed.mode,
      volunteersExternalUrl: parsed.externalUrl || null,
      volunteersAskDiet: parsed.askDiet,
      volunteersAskAllergies: parsed.askAllergies,
      volunteersAskTimePreferences: parsed.askTimePreferences,
      volunteersAskTeamPreferences: parsed.askTeamPreferences,
      volunteersAskPets: parsed.askPets,
      volunteersAskMinors: parsed.askMinors,
      volunteersAskVehicle: parsed.askVehicle,
      volunteersAskCompanion: parsed.askCompanion,
      volunteersAskAvoidList: parsed.askAvoidList,
      volunteersAskSkills: parsed.askSkills,
      volunteersAskExperience: parsed.askExperience,
      volunteersAskEmergencyContact: parsed.askEmergencyContact,
      volunteersSetupStartDate: parsed.setupStartDate,
      volunteersTeardownEndDate: parsed.setupEndDate,
      volunteersAskSetup: parsed.askSetup,
      volunteersAskTeardown: parsed.askTeardown,
    }

    // Construire les données de mise à jour avec buildUpdateData
    const data = buildUpdateData(mappedData, {
      transform: {
        volunteersSetupStartDate: (val) => (val ? new Date(val) : null),
        volunteersTeardownEndDate: (val) => (val ? new Date(val) : null),
        volunteersDescription: (val) => val || null,
        volunteersExternalUrl: (val) => val || null,
      },
    }) as EditionUpdateInput

    if (Object.keys(data).length === 0) return { success: true, unchanged: true }
    data.volunteersUpdatedAt = new Date()

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data,
      select: {
        volunteersOpen: true,
        volunteersDescription: true,
        volunteersMode: true,
        volunteersExternalUrl: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskCompanion: true,
        volunteersAskAvoidList: true,
        volunteersAskSkills: true,
        volunteersAskExperience: true,
        volunteersAskEmergencyContact: true,
        volunteersSetupStartDate: true,
        volunteersTeardownEndDate: true,
        volunteersAskSetup: true,
        volunteersAskTeardown: true,
        volunteersUpdatedAt: true,
      },
    })
    return { success: true, settings: updated }
  },
  { operationName: 'UpdateVolunteerSettings' }
)
