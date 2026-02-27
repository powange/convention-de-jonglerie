import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { validateAndSanitize } from '#server/utils/validation-schemas'

const locationSchema = z.object({
  name: z.string().min(1).max(100),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      include: {
        convention: {
          include: {
            organizers: true,
          },
        },
        organizerPermissions: {
          include: {
            organizer: true,
          },
        },
      },
      errorMessage: 'Édition non trouvée',
    })

    // Vérifier les permissions (organisateur uniquement)
    const hasPermission = canEditEdition(edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les lieux de cette édition",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(locationSchema, body)

    // Créer le lieu
    const location = await prisma.workshopLocation.create({
      data: {
        editionId,
        name: validatedData.name,
      },
    })

    return createSuccessResponse(location)
  },
  { operationName: 'CreateWorkshopLocation' }
)
