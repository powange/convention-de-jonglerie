import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Édition non trouvée',
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
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true,
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

    // Transformer les emails en emailHash
    const transformedPosts = posts.map((post) => {
      const { email: postUserEmail, ...postUserWithoutEmail } = post.user
      return {
        ...post,
        user: {
          ...postUserWithoutEmail,
          emailHash: getEmailHash(postUserEmail),
        },
        comments: post.comments.map((comment) => {
          const { email: commentUserEmail, ...commentUserWithoutEmail } = comment.user
          return {
            ...comment,
            user: {
              ...commentUserWithoutEmail,
              emailHash: getEmailHash(commentUserEmail),
            },
          }
        }),
      }
    })

    return transformedPosts
  },
  { operationName: 'GetEditionPosts' }
)
