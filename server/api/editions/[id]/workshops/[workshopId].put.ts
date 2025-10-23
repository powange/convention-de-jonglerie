import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import {
  updateWorkshopSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const workshopId = parseInt(getRouterParam(event, 'workshopId')!)

  if (isNaN(editionId) || isNaN(workshopId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: workshopId,
        editionId,
      },
      include: {
        edition: {
          select: {
            startDate: true,
            endDate: true,
            workshopLocationsFreeInput: true,
          },
        },
      },
    })

    if (!workshop) {
      throw createError({
        statusCode: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Vérifier les permissions pour modifier le workshop
    const hasPermission = await canEditWorkshop(user.id, workshopId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message:
          "Vous n'êtes pas autorisé à modifier ce workshop. Seuls le créateur ou les organisateurs peuvent le faire.",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(updateWorkshopSchema, {
      ...body,
      editionStartDate: workshop.edition.startDate.toISOString(),
      editionEndDate: workshop.edition.endDate.toISOString(),
    })

    // Préparer les données de mise à jour
    const updateData: any = {}

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.startDateTime !== undefined) {
      updateData.startDateTime = new Date(validatedData.startDateTime)
    }
    if (validatedData.endDateTime !== undefined) {
      updateData.endDateTime = new Date(validatedData.endDateTime)
    }
    if (validatedData.maxParticipants !== undefined) {
      updateData.maxParticipants = validatedData.maxParticipants
    }

    // Gérer le lieu du workshop
    if (validatedData.locationId !== undefined) {
      updateData.locationId = validatedData.locationId
    } else if (validatedData.locationName && workshop.edition.workshopLocationsFreeInput) {
      // Si un nom de lieu est fourni (mode libre), créer ou récupérer le lieu
      const locationName = validatedData.locationName.trim()

      // Chercher si le lieu existe déjà
      const existingLocation = await prisma.workshopLocation.findFirst({
        where: {
          editionId,
          name: locationName,
        },
      })

      if (existingLocation) {
        updateData.locationId = existingLocation.id
      } else {
        // Créer le nouveau lieu
        const newLocation = await prisma.workshopLocation.create({
          data: {
            editionId,
            name: locationName,
          },
        })
        updateData.locationId = newLocation.id
      }
    }

    // Mettre à jour le workshop
    const updatedWorkshop = await prisma.workshop.update({
      where: { id: workshopId },
      data: updateData,
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

    return updatedWorkshop
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }

    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la modification du workshop:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
