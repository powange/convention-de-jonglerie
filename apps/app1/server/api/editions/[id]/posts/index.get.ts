import { wrapApiHandler } from '#server/utils/api-helpers'
import { assurerEditionLisible } from '#server/utils/edition-lisible'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    /*
     * ⚠️ CETTE ROUTE EST PUBLIQUE, et elle ne vérifiait QUE l'existence de l'édition — pas son
     * statut. Les publications et les commentaires d'une édition retirée de la vue du public
     * restaient donc lisibles à qui connaissait son numéro, PSEUDOS ET AVATARS DES AUTEURS
     * COMPRIS, alors que la fiche de cette même édition répond 404.
     *
     * 📍 Les publications n'ont PAS de drapeau de publication propre, contrairement au programme
     * (`programPagePublic`) ou à la carte (`mapPublic`) : le statut de l'édition est donc le seul
     * verrou, et c'est pourquoi son absence se payait ici.
     *
     * `hydrateSession: true` dans `public-routes.ts` : la session est disponible malgré le
     * caractère public de la route, donc un organisateur voit bien les publications de son
     * édition hors ligne.
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

    // Récupérer les posts avec leurs commentaires et auteurs
    const posts = await prisma.editionPost.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            emailHash: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                emailHash: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        { pinned: 'desc' }, // Posts épinglés en premier
        { createdAt: 'desc' }, // Puis par date de création
      ],
    })

    return posts
  },
  { operationName: 'GetEditionPosts' }
)
