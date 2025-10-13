import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis").max(100),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'La couleur doit être un code hexadécimal valide')
    .default('#6b7280'),
  maxVolunteers: z.number().int().positive().optional(),
  isRequired: z.boolean().optional().default(false),
  isAccessControlTeam: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  // Validation du body
  const body = await readValidatedBody(event, createTeamSchema.parse)

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Vérifier qu'une équipe avec ce nom n'existe pas déjà pour cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        editionId,
        name: body.name,
      },
    })

    if (existingTeam) {
      throw createError({
        statusCode: 400,
        message: 'Une équipe avec ce nom existe déjà pour cette édition',
      })
    }

    // Créer l'équipe
    const team = await prisma.volunteerTeam.create({
      data: {
        editionId,
        name: body.name,
        description: body.description,
        color: body.color,
        maxVolunteers: body.maxVolunteers,
        isRequired: body.isRequired,
        isAccessControlTeam: body.isAccessControlTeam,
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    setResponseStatus(event, 201)
    return team
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de la création de l'équipe",
    })
  }
})
