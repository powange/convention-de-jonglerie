import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { getEditionForStatusManagement } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const statusSchema = z.object({
  status: z.enum(['PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED']),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const validatedData = statusSchema.parse(body)

    // Récupère l'édition et vérifie les permissions de gestion de statut
    await getEditionForStatusManagement(editionId, user)

    // Récupérer le statut actuel pour détecter la transition vers PUBLISHED
    const currentEdition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { status: true },
    })

    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
      data: { status: validatedData.status },
      include: {
        creator: {
          select: { id: true, pseudo: true, emailHash: true, profilePicture: true },
        },
        convention: {
          include: {
            organizers: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    emailHash: true,
                    profilePicture: true,
                  },
                },
              },
            },
          },
        },
        favoritedBy: { select: { id: true } },
      },
    })

    // Notifier les utilisateurs ayant favorisé l'édition si elle passe en PUBLISHED
    if (validatedData.status === 'PUBLISHED' && currentEdition?.status !== 'PUBLISHED') {
      const editionName = updatedEdition.name || updatedEdition.convention.name
      const conventionName = updatedEdition.convention.name

      for (const favUser of updatedEdition.favoritedBy) {
        await safeNotify(
          () =>
            NotificationHelpers.editionPublished(
              favUser.id,
              editionName,
              conventionName,
              editionId
            ),
          'notification édition publiée'
        )
      }
    }

    // Les données retournées directement de Prisma ne contiennent plus d'email
    return updatedEdition
  },
  { operationName: 'UpdateEditionStatus' }
)
