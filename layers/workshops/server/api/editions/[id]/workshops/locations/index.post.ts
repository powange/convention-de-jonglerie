import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageWorkshopLocations } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { validateAndSanitize } from '#server/utils/validation-schemas'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'

const locationSchema = z.object({
  name: z.string().min(1).max(100),
  zoneId: z.number().int().positive().optional(),
  markerId: z.number().int().positive().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'événement existe (via le port ; le layer ne lit pas Edition directement)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)
    if (!cfg.found) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    // Vérifier les permissions (organisateur uniquement) — util core, lit l'Edition côté core
    const hasPermission = await canManageWorkshopLocations(user, editionId)
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
        zoneId: validatedData.zoneId || null,
        markerId: validatedData.markerId || null,
      },
    })

    return createSuccessResponse(location)
  },
  { operationName: 'CreateWorkshopLocation' }
)
