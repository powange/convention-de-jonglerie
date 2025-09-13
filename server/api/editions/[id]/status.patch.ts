import { z } from 'zod'

import { requireAuth } from '../../../utils/auth-utils'
import {
  getEditionForStatusManagement,
  validateEditionId,
} from '../../../utils/edition-permissions'
import { getEmailHash } from '../../../utils/email-hash'
import { prisma } from '../../../utils/prisma'

const statusSchema = z.object({
  isOnline: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = validateEditionId(event.context.params?.id)

  const body = await readBody(event)
  const validatedData = statusSchema.parse(body)

  // Récupère l'édition et vérifie les permissions de gestion de statut
  await getEditionForStatusManagement(editionId, user)

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
