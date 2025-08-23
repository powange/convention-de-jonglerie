import { z } from 'zod'

import { prisma } from '../../../utils/prisma'

const statusSchema = z.object({
  isOnline: z.boolean(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  const editionId = parseInt(event.context.params?.id as string)
  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  const body = await readBody(event)
  const validatedData = statusSchema.parse(body)

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: {
            include: {
              user: {
                select: { id: true, pseudo: true, emailHash: true },
              },
            },
          },
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Édition introuvable',
    })
  }

  const userId = event.context.user.id
  const isCreator = edition.creatorId === userId
  const isConventionAuthor = edition.convention.authorId === userId
  const collaboration = edition.convention.collaborators.find((c) => c.userId === userId)
  const canManage =
    isCreator ||
    isConventionAuthor ||
    (collaboration &&
      (collaboration.canEditAllEditions ||
        collaboration.canEditConvention ||
        collaboration.canManageCollaborators))

  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: "Vous n'avez pas la permission de modifier le statut de cette édition",
    })
  }

  const updatedEdition = await prisma.edition.update({
    where: { id: editionId },
    data: { isOnline: validatedData.isOnline },
    include: {
      creator: { select: { id: true, pseudo: true } },
      convention: {
        include: {
          collaborators: {
            include: {
              user: {
                select: { id: true, pseudo: true, emailHash: true }, // email supprimé
              },
            },
          },
        },
      },
      favoritedBy: { select: { id: true } },
    },
  })

  return updatedEdition
})
