import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { sanitizeUserContent, validateEditionId } from '#server/utils/validation-helpers'
import { editionPostSchema, validateAndSanitize } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Espace de discussion de l'édition : toute personne connectée peut publier.
    // La modération reste réservée : l'auteur supprime sa publication, les
    // organisateurs modèrent celles des autres, l'épinglage exige canEdit.
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
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
