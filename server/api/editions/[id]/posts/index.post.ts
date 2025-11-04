import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { editionPostSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Édition non trouvée',
    })

    // Vérifier les permissions pour poster sur cette édition
    const hasPermission = await hasEditionEditPermission(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: 'Vous devez être collaborateur pour poster sur cette édition',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(editionPostSchema, body)

    // Créer le post
    const newPost = await prisma.editionPost.create({
      data: {
        content: validatedData.content,
        editionId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return newPost
  },
  { operationName: 'CreateEditionPost' }
)
