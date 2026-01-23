import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEditionForStatusManagement } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

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

    // Les données retournées directement de Prisma ne contiennent plus d'email
    return updatedEdition
  },
  { operationName: 'UpdateEditionStatus' }
)
