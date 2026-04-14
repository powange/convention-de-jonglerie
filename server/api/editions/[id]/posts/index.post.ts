import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { sanitizeUserContent, validateEditionId } from '#server/utils/validation-helpers'
import { editionPostSchema, validateAndSanitize } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'utilisateur est organisateur de cette édition
    const hasPermission = await canAccessEditionData(editionId, user.id, event)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à créer un post sur cette édition",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(editionPostSchema, body)

    // Créer le post
    const newPost = await prisma.editionPost.create({
      data: {
        content: sanitizeUserContent(validatedData.content),
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
