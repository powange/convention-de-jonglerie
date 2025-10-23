import { requireAuth } from '@@/server/utils/auth-utils'
import { canCreateWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import {
  workshopSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier que l'édition existe et que les workshops sont activés
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        workshopsEnabled: true,
        workshopLocationsFreeInput: true,
        startDate: true,
        endDate: true,
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!edition.workshopsEnabled) {
      throw createError({
        statusCode: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier les permissions pour créer un workshop
    const hasPermission = await canCreateWorkshop(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message:
          'Vous devez être bénévole accepté, organisateur ou participant pour créer un workshop',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(workshopSchema, {
      ...body,
      editionStartDate: edition.startDate.toISOString(),
      editionEndDate: edition.endDate.toISOString(),
    })

    // Gérer le lieu du workshop
    let locationId = validatedData.locationId || null

    // Si un nom de lieu est fourni (mode libre) et pas d'ID, créer ou récupérer le lieu
    if (validatedData.locationName && !locationId && edition.workshopLocationsFreeInput) {
      const locationName = validatedData.locationName.trim()

      // Chercher si le lieu existe déjà
      const existingLocation = await prisma.workshopLocation.findFirst({
        where: {
          editionId,
          name: locationName,
        },
      })

      if (existingLocation) {
        locationId = existingLocation.id
      } else {
        // Créer le nouveau lieu
        const newLocation = await prisma.workshopLocation.create({
          data: {
            editionId,
            name: locationName,
          },
        })
        locationId = newLocation.id
      }
    }

    // Créer le workshop
    const newWorkshop = await prisma.workshop.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        startDateTime: new Date(validatedData.startDateTime),
        endDateTime: new Date(validatedData.endDateTime),
        maxParticipants: validatedData.maxParticipants || null,
        locationId,
        editionId,
        creatorId: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return newWorkshop
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }

    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la création du workshop:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
