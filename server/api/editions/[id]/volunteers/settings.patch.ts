import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'
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

    // Permission: auteur convention ou collaborateur avec droit gestion bénévoles
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { conventionId: true, volunteersMode: true },
    })
    if (!edition) throw createError({ statusCode: 404, message: 'Edition introuvable' })
    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })

    const data: EditionUpdateInput = {}
    if (parsed.open !== undefined) data.volunteersOpen = parsed.open
    if (parsed.description !== undefined) data.volunteersDescription = parsed.description || null
    if (parsed.mode !== undefined) data.volunteersMode = parsed.mode
    if (parsed.externalUrl !== undefined) {
      // Si mode externe requis mais pas d'URL -> erreur explicite
      if (
        (parsed.mode === 'EXTERNAL' || edition?.volunteersMode === 'EXTERNAL') &&
        !parsed.externalUrl
      ) {
        throw createError({
          statusCode: 400,
          message: 'URL externe requise pour le mode EXTERNAL',
        })
      }
      data.volunteersExternalUrl = parsed.externalUrl || null
    }
    if (parsed.askDiet !== undefined) data.volunteersAskDiet = parsed.askDiet
    if (parsed.askAllergies !== undefined) data.volunteersAskAllergies = parsed.askAllergies
    if (parsed.askTimePreferences !== undefined)
      data.volunteersAskTimePreferences = parsed.askTimePreferences
    if (parsed.askTeamPreferences !== undefined)
      data.volunteersAskTeamPreferences = parsed.askTeamPreferences
    if (parsed.askPets !== undefined) data.volunteersAskPets = parsed.askPets
    if (parsed.askMinors !== undefined) data.volunteersAskMinors = parsed.askMinors
    if (parsed.askVehicle !== undefined) data.volunteersAskVehicle = parsed.askVehicle
    if (parsed.askCompanion !== undefined) data.volunteersAskCompanion = parsed.askCompanion
    if (parsed.askAvoidList !== undefined) data.volunteersAskAvoidList = parsed.askAvoidList
    if (parsed.askSkills !== undefined) data.volunteersAskSkills = parsed.askSkills
    if (parsed.askExperience !== undefined) data.volunteersAskExperience = parsed.askExperience
    if (parsed.askEmergencyContact !== undefined)
      data.volunteersAskEmergencyContact = parsed.askEmergencyContact
    if (parsed.setupStartDate !== undefined)
      data.volunteersSetupStartDate = parsed.setupStartDate ? new Date(parsed.setupStartDate) : null
    if (parsed.setupEndDate !== undefined)
      data.volunteersTeardownEndDate = parsed.setupEndDate ? new Date(parsed.setupEndDate) : null
    if (parsed.askSetup !== undefined) data.volunteersAskSetup = parsed.askSetup
    if (parsed.askTeardown !== undefined) data.volunteersAskTeardown = parsed.askTeardown
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
