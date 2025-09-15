import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

const updateTeamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis").max(100).optional(),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'La couleur doit être un code hexadécimal valide')
    .optional(),
  maxVolunteers: z.number().int().positive().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const teamId = getRouterParam(event, 'teamId') as string

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  if (!teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'équipe invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  // Validation du body
  const body = await readValidatedBody(event, updateTeamSchema.parse)

  try {
    // Vérifier que l'équipe existe et appartient à cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        id: teamId,
        editionId,
      },
    })

    if (!existingTeam) {
      throw createError({
        statusCode: 404,
        statusMessage: "Équipe non trouvée ou n'appartient pas à cette édition",
      })
    }

    // Vérifier qu'une équipe avec ce nom n'existe pas déjà (si le nom change)
    if (body.name && body.name !== existingTeam.name) {
      const nameConflict = await prisma.volunteerTeam.findFirst({
        where: {
          editionId,
          name: body.name,
          id: { not: teamId },
        },
      })

      if (nameConflict) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Une équipe avec ce nom existe déjà pour cette édition',
        })
      }
    }

    // Mise à jour de l'équipe
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.color !== undefined) updateData.color = body.color
    if (body.maxVolunteers !== undefined) updateData.maxVolunteers = body.maxVolunteers

    const team = await prisma.volunteerTeam.update({
      where: { id: teamId },
      data: updateData,
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    return team
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de la mise à jour de l'équipe",
    })
  }
})
