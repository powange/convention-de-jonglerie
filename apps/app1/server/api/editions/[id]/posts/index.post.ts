import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { assurerEditionLisible } from '#server/utils/edition-lisible'
import { sanitizeUserContent, validateEditionId } from '#server/utils/validation-helpers'
import { editionPostSchema, validateAndSanitize } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    /*
     * Espace de discussion de l'édition : toute personne connectée peut publier. La modération
     * reste réservée — l'auteur supprime sa publication, les organisateurs modèrent celles des
     * autres, l'épinglage exige canEdit.
     *
     * ⚠️ MAIS PAS SUR UNE ÉDITION QU'ON A RETIRÉE DE LA VUE DU PUBLIC. Le contrôle ne portait que
     * sur l'EXISTENCE de l'édition : on pouvait publier sur une édition `OFFLINE` en connaissant
     * son numéro, et le message y restait — invisible de tous, y compris de son auteur dès qu'il
     * quittait la page.
     */
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        status: true,
        creatorId: true,
        convention: { select: { authorId: true } },
      },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    await assurerEditionLisible(event, editionId, {
      status: edition.status,
      creatorId: edition.creatorId,
      conventionAuthorId: edition.convention?.authorId ?? null,
    })

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
