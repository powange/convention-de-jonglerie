import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { conventionSchema, handleValidationError } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    const body = await readBody(event)

    // Validation avec Zod
    const validatedData = conventionSchema.parse(body)

    // Sanitisation
    const cleanName = validatedData.name.trim()
    const cleanDescription = validatedData.description?.trim() || null
    const cleanEmail = validatedData.email?.trim() || null
    const cleanLogo = validatedData.logo?.trim() || null

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

    // Ajouter automatiquement le créateur comme collaborateur avec tous les droits
    await prisma.conventionCollaborator.create({
      data: {
        conventionId: convention.id,
        userId: user.id,
        addedById: user.id,
        title: 'Créateur',
        canEditConvention: true,
        canDeleteConvention: true,
        canManageCollaborators: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
      },
    })

    // Retourner la convention transformée (pas d'exposition d'email)
    const conventionWithCollaborators = await prisma.convention.findUnique({
      where: { id: convention.id },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        collaborators: {
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
      ...conventionWithCollaborators,
      author: conventionWithCollaborators?.author
        ? (() => {
            const { email, ...authorWithoutEmail } = conventionWithCollaborators.author
            return {
              ...authorWithoutEmail,
              emailHash: email ? getEmailHash(email) : undefined,
            }
          })()
        : null,
      collaborators: (conventionWithCollaborators?.collaborators || []).map((c: any) => ({
        id: c.id,
        addedAt: c.addedAt,
        title: c.title ?? null,
        rights: {
          editConvention: c.canEditConvention,
          deleteConvention: c.canDeleteConvention,
          manageCollaborators: c.canManageCollaborators,
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
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }

    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Erreur lors de la création de la convention:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la création de la convention',
    })
  }
})
