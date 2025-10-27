import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const artistSchema = z.object({
  userId: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  prenom: z.string().min(1).optional(),
  nom: z.string().min(1).optional(),
  arrivalDateTime: z.string().optional().nullable(),
  departureDateTime: z.string().optional().nullable(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).default('NONE'),
  allergies: z.string().optional().nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
  payment: z.number().optional().nullable(),
  paymentPaid: z.boolean().optional(),
  reimbursement: z.number().optional().nullable(),
  reimbursementPaid: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

  // Vérifier les permissions
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

  const hasPermission = canEditEdition(edition, user)
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
    })
  }

  try {
    const body = await readBody(event)
    const validatedData = artistSchema.parse(body)

    let targetUserId = validatedData.userId

    // Si pas d'userId fourni, créer un nouvel utilisateur
    if (!targetUserId) {
      if (!validatedData.email || !validatedData.prenom || !validatedData.nom) {
        throw createError({
          statusCode: 400,
          message: 'Email, prénom et nom sont requis pour créer un nouvel utilisateur',
        })
      }

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      })

      if (existingUser) {
        targetUserId = existingUser.id
      } else {
        // Créer un nouvel utilisateur
        const newUser = await prisma.user.create({
          data: {
            email: validatedData.email,
            prenom: validatedData.prenom,
            nom: validatedData.nom,
            pseudo: `${validatedData.prenom.toLowerCase()}_${validatedData.nom.toLowerCase()}_${Date.now()}`,
            isEmailVerified: false,
          },
        })
        targetUserId = newUser.id
      }
    }

    // Vérifier si l'artiste n'est pas déjà dans l'édition
    const existingArtist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: targetUserId,
        },
      },
    })

    if (existingArtist) {
      throw createError({
        statusCode: 400,
        message: 'Cet utilisateur est déjà artiste pour cette édition',
      })
    }

    // Créer l'artiste
    const artist = await prisma.editionArtist.create({
      data: {
        editionId,
        userId: targetUserId,
        arrivalDateTime: validatedData.arrivalDateTime,
        departureDateTime: validatedData.departureDateTime,
        dietaryPreference: validatedData.dietaryPreference,
        allergies: validatedData.allergies,
        allergySeverity: validatedData.allergySeverity,
        payment: validatedData.payment,
        paymentPaid: validatedData.paymentPaid ?? false,
        reimbursement: validatedData.reimbursement,
        reimbursementPaid: validatedData.reimbursementPaid ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            phone: true,
          },
        },
        shows: true,
      },
    })

    return {
      success: true,
      artist,
    }
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

    console.error("Erreur lors de l'ajout de l'artiste:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'ajout de l'artiste",
    })
  }
})
