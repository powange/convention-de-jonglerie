import { createHash } from 'node:crypto'

import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition invalide",
      })
    }

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
      const userEmail = (item.user as any).email as string | undefined
      const emailHash = userEmail
        ? createHash('md5').update(userEmail.trim().toLowerCase()).digest('hex')
        : undefined
      const user = { ...item.user, emailHash }
      delete (user as any).email
      const comments = item.comments.map((c) => {
        const cEmail = (c.user as any).email as string | undefined
        const cHash = cEmail
          ? createHash('md5').update(cEmail.trim().toLowerCase()).digest('hex')
          : undefined
        const cUser = { ...c.user, emailHash: cHash }
        delete (cUser as any).email
        return { ...c, user: cUser }
      })
      return { ...item, user, comments }
    })
    return items
  } catch (error) {
    console.error('Erreur lors de la récupération des objets trouvés:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
