import { z } from 'zod'

import { getEmailHash } from '../../../utils/email-hash'
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
              user: { select: { id: true, pseudo: true, email: true } },
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
      creator: { select: { id: true, pseudo: true, email: true } },
      convention: {
        include: {
          collaborators: {
            include: {
              user: { select: { id: true, pseudo: true, email: true } },
            },
          },
        },
      },
      favoritedBy: { select: { id: true } },
    },
  })

  // Transformer la réponse pour ajouter emailHash et retirer les emails
  const sanitized = {
    ...updatedEdition,
    creator: {
      id: updatedEdition.creator.id,
      pseudo: updatedEdition.creator.pseudo,
      emailHash: getEmailHash(updatedEdition.creator.email),
    },
    convention: {
      ...updatedEdition.convention,
      collaborators: updatedEdition.convention.collaborators.map((c) => ({
        ...c,
        user: {
          id: c.user.id,
          pseudo: c.user.pseudo,
          emailHash: getEmailHash(c.user.email),
        },
      })),
    },
  }

  // Supprimer les champs email internes
  // @ts-expect-error suppression email propriété intermédiaire
  delete sanitized.creator.email
  // @ts-expect-error suppression email propriété intermédiaire
  sanitized.convention.collaborators.forEach((c) => delete c.user.email)

  return sanitized
})
