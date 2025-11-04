import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'objet')
    const body = await readBody(event)

    const user = requireAuth(event)
    const userId = user.id

    // Vérifier que l'objet trouvé existe et appartient à l'édition
    const lostFoundItem = await prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        editionId: editionId,
      },
    })

    if (!lostFoundItem) {
      throw createError({
        statusCode: 404,
        message: 'Objet trouvé non trouvé',
      })
    }

    // Valider le contenu
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Le contenu du commentaire est requis',
      })
    }

    // Créer le commentaire
    const rawComment = await prisma.lostFoundComment.create({
      data: {
        lostFoundItemId: itemId,
        userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            updatedAt: true,
            email: true,
          },
        },
      },
    })

    const { email, ...userWithoutEmail } = rawComment.user
    const commentUser = {
      ...userWithoutEmail,
      emailHash: getEmailHash(email),
    }

    return { ...rawComment, user: commentUser }
  },
  { operationName: 'CreateLostFoundComment' }
)
