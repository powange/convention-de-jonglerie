import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  handoutItemId: z.number(),
})

/**
 * Associe un article à remettre à TOUS les artistes de l'édition.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Vérifier que l'article à remettre existe et appartient à l'édition
      const handoutItem = await prisma.ticketingHandoutItem.findFirst({
        where: { id: body.handoutItemId, editionId },
      })

      if (!handoutItem) {
        throw createError({
          status: 404,
          message: 'Article à remettre introuvable',
        })
      }

      // Vérifier que l'association n'existe pas déjà
      const existing = await prisma.editionArtistHandoutItem.findUnique({
        where: {
          editionId_handoutItemId: { editionId, handoutItemId: body.handoutItemId },
        },
      })

      if (existing) {
        throw createError({
          status: 400,
          message: 'Cet article est déjà associé à tous les artistes',
        })
      }

      const item = await prisma.editionArtistHandoutItem.create({
        data: { editionId, handoutItemId: body.handoutItemId },
      })

      return createSuccessResponse({
        item: {
          id: item.id,
          handoutItemId: item.handoutItemId,
          handoutItemName: handoutItem.name,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      })
    } catch (error: unknown) {
      console.error("Erreur lors de l'ajout de l'article pour les artistes:", error)
      if (isHttpError(error)) throw error
      throw createError({
        status: 500,
        message: "Erreur lors de l'ajout de l'article",
      })
    }
  },
  { operationName: 'POST ticketing artists handout-items index' }
)
