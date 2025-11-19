import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageTicketing } from '@@/server/utils/permissions/edition-permissions'
import { buildUpdateData, fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { handleValidationError } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

import type { EditionUpdateInput } from '@@/server/types/prisma-helpers'

const bodySchema = z.object({
  allowOnsiteRegistration: z.boolean().optional(),
  allowAnonymousOrders: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event).catch(() => ({}))

    // Validation avec gestion d'erreur appropriée
    let parsed
    try {
      parsed = bodySchema.parse(body || {})
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    // Récupérer l'édition avec les relations nécessaires pour vérifier les permissions
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: {
        id: true,
        convention: {
          include: {
            organizers: {
              where: {
                userId: user.id,
              },
            },
          },
        },
        organizerPermissions: {
          where: {
            organizer: {
              userId: user.id,
            },
          },
          include: {
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    // Vérifier les permissions
    if (!canManageTicketing(edition, user)) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour gérer la billetterie',
      })
    }

    // Mapper les champs de l'API vers les champs de la BDD
    const mappedData = {
      ticketingAllowOnsiteRegistration: parsed.allowOnsiteRegistration,
      ticketingAllowAnonymousOrders: parsed.allowAnonymousOrders,
    }

    // Construire les données de mise à jour avec buildUpdateData
    const data = buildUpdateData(mappedData) as EditionUpdateInput

    if (Object.keys(data).length === 0) return { success: true, unchanged: true }

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data,
      select: {
        ticketingAllowOnsiteRegistration: true,
        ticketingAllowAnonymousOrders: true,
      },
    })

    return {
      success: true,
      settings: {
        allowOnsiteRegistration: updated.ticketingAllowOnsiteRegistration ?? true,
        allowAnonymousOrders: updated.ticketingAllowAnonymousOrders ?? false,
      },
    }
  },
  { operationName: 'UpdateTicketingSettings' }
)
