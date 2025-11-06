import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Cette route est publique pour permettre la consultation des conventions
    // L'authentification et les droits d'édition sont vérifiés côté client

    const conventionId = validateConventionId(event)

    // Récupérer la convention
    const convention = await fetchResourceOrFail(prisma.convention, conventionId, {
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        organizers: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      errorMessage: 'Convention introuvable',
    })

    // Transformer auteur (emailHash) et organisateurs avec nouveaux droits
    const transformed = {
      ...convention,
      author: convention.author
        ? (() => {
            const { email, ...authorWithoutEmail } = convention.author
            return {
              ...authorWithoutEmail,
              emailHash: email ? getEmailHash(email) : undefined,
            }
          })()
        : null,
      organizers: convention.organizers.map((c) => ({
        id: c.id,
        addedAt: c.addedAt,
        title: c.title ?? null,
        rights: {
          editConvention: c.canEditConvention,
          deleteConvention: c.canDeleteConvention,
          manageOrganizers: c.canManageOrganizers,
          addEdition: c.canAddEdition,
          editAllEditions: c.canEditAllEditions,
          deleteAllEditions: c.canDeleteAllEditions,
        },
        user: c.user,
      })),
    }

    return transformed
  },
  { operationName: 'GetConvention' }
)
