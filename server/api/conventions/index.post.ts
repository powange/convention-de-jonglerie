import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { sanitizeString } from '@@/server/utils/validation-helpers'
import { conventionSchema } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation avec Zod
    const validatedData = conventionSchema.parse(body)

    // Sanitisation
    const cleanName = sanitizeString(validatedData.name)!
    const cleanDescription = sanitizeString(validatedData.description)
    const cleanEmail = sanitizeString(validatedData.email)
    const cleanLogo = sanitizeString(validatedData.logo)

    // Créer la convention
    const convention = await prisma.convention.create({
      data: {
        name: cleanName,
        description: cleanDescription,
        email: cleanEmail,
        logo: cleanLogo,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })

    // Ajouter automatiquement le créateur comme organisateur avec tous les droits
    await prisma.conventionOrganizer.create({
      data: {
        conventionId: convention.id,
        userId: user.id,
        addedById: user.id,
        title: 'Créateur',
        canEditConvention: true,
        canDeleteConvention: true,
        canManageOrganizers: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
      },
    })

    // Retourner la convention transformée (pas d'exposition d'email)
    const conventionWithOrganizers = await prisma.convention.findUnique({
      where: { id: convention.id },
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
                email: true,
              },
            },
            addedBy: {
              select: {
                id: true,
                pseudo: true,
              },
            },
          },
        },
      },
    })
    const { getEmailHash } = await import('@@/server/utils/email-hash')
    const transformed = {
      ...conventionWithOrganizers,
      author: conventionWithOrganizers?.author
        ? (() => {
            const { email, ...authorWithoutEmail } = conventionWithOrganizers.author
            return {
              ...authorWithoutEmail,
              emailHash: email ? getEmailHash(email) : undefined,
            }
          })()
        : null,
      organizers: (conventionWithOrganizers?.organizers || []).map((c: any) => ({
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
        user: c.user
          ? (() => {
              const { email, ...userWithoutEmail } = c.user
              return {
                ...userWithoutEmail,
                emailHash: email ? getEmailHash(email) : undefined,
              }
            })()
          : null,
        addedBy: c.addedBy,
      })),
    }

    return transformed
  },
  { operationName: 'CreateConvention' }
)
