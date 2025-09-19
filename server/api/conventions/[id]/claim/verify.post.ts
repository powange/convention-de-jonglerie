import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'

const verifyClaimSchema = z.object({
  code: z.string().min(6).max(6),
})

export default defineEventHandler(async (event) => {
  try {
    // Vérifier que l'utilisateur est connecté
    const user = await requireAuth(event)

    const conventionId = getRouterParam(event, 'id')
    if (!conventionId) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention manquant',
      })
    }

    const body = await readBody(event)
    const { code } = verifyClaimSchema.parse(body)

    const conventionIdNum = parseInt(conventionId)

    // Vérifier que la convention existe et n'a pas de créateur
    const convention = await prisma.convention.findUnique({
      where: { id: conventionIdNum },
      include: {
        editions: true,
      },
    })

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention non trouvée',
      })
    }

    if (convention.authorId) {
      throw createError({
        statusCode: 400,
        message: 'Cette convention a déjà un créateur',
      })
    }

    // Trouver la demande de revendication
    const claimRequest = await prisma.conventionClaimRequest.findUnique({
      where: {
        conventionId_userId: {
          conventionId: conventionIdNum,
          userId: user.id,
        },
      },
    })

    if (!claimRequest) {
      throw createError({
        statusCode: 404,
        message: 'Aucune demande de revendication trouvée',
      })
    }

    // Vérifier que le code n'a pas expiré
    if (claimRequest.expiresAt < new Date()) {
      throw createError({
        statusCode: 400,
        message: 'Le code de vérification a expiré',
      })
    }

    // Vérifier le code
    if (claimRequest.code !== code) {
      throw createError({
        statusCode: 400,
        message: 'Code de vérification incorrect',
      })
    }

    // Marquer la demande comme vérifiée
    await prisma.conventionClaimRequest.update({
      where: { id: claimRequest.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    // Transférer la propriété de la convention et de toutes ses éditions
    await prisma.$transaction(async (tx) => {
      // Mettre à jour la convention
      await tx.convention.update({
        where: { id: conventionIdNum },
        data: { authorId: user.id },
      })

      // Mettre à jour toutes les éditions de cette convention
      await tx.edition.updateMany({
        where: { conventionId: conventionIdNum },
        data: { creatorId: user.id },
      })
    })

    // Supprimer la demande de revendication maintenant qu'elle est traitée
    await prisma.conventionClaimRequest.delete({
      where: { id: claimRequest.id },
    })

    return {
      message: 'Revendication réussie ! Vous êtes maintenant propriétaire de cette convention.',
      convention: {
        id: convention.id,
        name: convention.name,
        editionsCount: convention.editions.length,
      },
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de revendication:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la vérification du code',
    })
  }
})
