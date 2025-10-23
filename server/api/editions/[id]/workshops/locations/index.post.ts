import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const locationSchema = z.object({
  name: z.string().min(1).max(100),
})

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
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: true,
          },
        },
        collaboratorPermissions: {
          include: {
            collaborator: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Vérifier les permissions (organisateur uniquement)
    const hasPermission = canEditEdition(edition, user)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: "Vous n'êtes pas autorisé à gérer les lieux de cette édition",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = locationSchema.parse(body)

    // Créer le lieu
    const location = await prisma.workshopLocation.create({
      data: {
        editionId,
        name: validatedData.name,
      },
    })

    return location
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error.errors,
      })
    }

    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la création du lieu:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
