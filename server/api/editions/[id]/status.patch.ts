import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { getEditionForStatusManagement } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const statusSchema = z.object({
  isOnline: z.boolean(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const validatedData = statusSchema.parse(body)

    // Récupère l'édition et vérifie les permissions de gestion de statut
    await getEditionForStatusManagement(editionId, user)

    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
      data: { isOnline: validatedData.isOnline },
      include: {
        creator: { select: { id: true, pseudo: true, email: true, profilePicture: true } },
        convention: {
          include: {
            organizers: {
              include: {
                user: { select: { id: true, pseudo: true, email: true, profilePicture: true } },
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
        profilePicture: updatedEdition.creator.profilePicture,
      },
      convention: {
        ...updatedEdition.convention,
        organizers: updatedEdition.convention.organizers.map((c) => ({
          ...c,
          user: {
            id: c.user.id,
            pseudo: c.user.pseudo,
            emailHash: getEmailHash(c.user.email),
            profilePicture: c.user.profilePicture,
          },
        })),
      },
    }

    // Supprimer les champs email internes
    // @ts-expect-error suppression email propriété intermédiaire
    delete sanitized.creator.email
    // @ts-expect-error suppression email propriété intermédiaire
    sanitized.convention.organizers.forEach((c) => delete c.user.email)

    return sanitized
  },
  { operationName: 'UpdateEditionStatus' }
)
