import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { z } from 'zod'

const bodySchema = z.object({
  positions: z.array(
    z.object({
      id: z.number(),
      position: z.number(),
    })
  ),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Mettre à jour les positions en utilisant une transaction
      await prisma.$transaction(
        body.positions.map((item) =>
          prisma.ticketingQuota.update({
            where: {
              id: item.id,
              editionId, // Vérifier que le quota appartient bien à cette édition
            },
            data: {
              position: item.position,
            },
          })
        )
      )

      return {
        success: true,
        message: 'Positions mises à jour avec succès',
      }
    } catch (error: unknown) {
      console.error('Failed to update quotas positions:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la mise à jour des positions',
      })
    }
  },
  { operationName: 'PUT ticketing quotas reorder' }
)
