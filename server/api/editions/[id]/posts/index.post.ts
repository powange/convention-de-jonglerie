import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { editionPostSchema, validateAndSanitize } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Édition non trouvée',
    })

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

    return createSuccessResponse(newPost)
  },
  { operationName: 'CreateEditionPost' }
)
