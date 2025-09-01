import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  open: z.boolean().optional(),
  description: z.string().max(5000).optional().nullable(),
  mode: z.enum(['INTERNAL', 'EXTERNAL']).optional(),
  externalUrl: z.string().url('URL externe invalide').max(1000).optional().nullable(),
  askDiet: z.boolean().optional(),
  askAllergies: z.boolean().optional(),
  askTimePreferences: z.boolean().optional(),
  askTeamPreferences: z.boolean().optional(),
  askPets: z.boolean().optional(),
  askMinors: z.boolean().optional(),
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

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })
  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body || {})

  // Permission: auteur convention ou collaborateur avec droit gestion bénévoles
  const edition = (await prisma.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true, volunteersMode: true } as any,
  })) as any
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Edition introuvable' })
  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id)
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
    })

  const data: any = {}
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
        statusMessage: 'URL externe requise pour le mode EXTERNAL',
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
  if (parsed.teams !== undefined) data.volunteersTeams = parsed.teams
  if (Object.keys(data).length === 0) return { success: true, unchanged: true }
  data.volunteersUpdatedAt = new Date()

  const updated = (await prisma.edition.update({
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
      volunteersTeams: true,
      volunteersUpdatedAt: true,
    } as any,
  })) as any
  return { success: true, settings: updated }
})
