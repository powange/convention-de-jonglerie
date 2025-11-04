import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, endDate: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Récupérer tous les objets trouvés de l'édition
    const rawItems = await prisma.lostFoundItem.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            email: true,
            updatedAt: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
                email: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const items = rawItems.map((item) => {
      const { email, ...userWithoutEmail } = item.user
      const user = {
        ...userWithoutEmail,
        emailHash: getEmailHash(email),
      }

      const comments = item.comments.map((c) => {
        const { email: commentEmail, ...commentUserWithoutEmail } = c.user
        return {
          ...c,
          user: {
            ...commentUserWithoutEmail,
            emailHash: getEmailHash(commentEmail),
          },
        }
      })

      return { ...item, user, comments }
    })
    return items
  },
  { operationName: 'GetLostFoundItems' }
)
