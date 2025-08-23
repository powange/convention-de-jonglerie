import { z } from 'zod'

import { prisma } from '../../utils/prisma'
import { conventionSchema, handleValidationError } from '../../utils/validation-schemas'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  try {
    const body = await readBody(event)

    // Validation avec Zod
    const validatedData = conventionSchema.parse(body)

    // Sanitisation
    const cleanName = validatedData.name.trim()
    const cleanDescription = validatedData.description?.trim() || null
    const cleanLogo = validatedData.logo?.trim() || null

    // Créer la convention
    const convention = await prisma.convention.create({
      data: {
        name: cleanName,
        description: cleanDescription,
        logo: cleanLogo,
        authorId: event.context.user.id,
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
        userId: event.context.user.id,
        addedById: event.context.user.id,
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
    const { getEmailHash } = await import('../../utils/email-hash')
    const transformed = {
      ...conventionWithCollaborators,
      author: conventionWithCollaborators?.author
        ? {
            ...conventionWithCollaborators.author,
            emailHash: conventionWithCollaborators.author.email
              ? getEmailHash(conventionWithCollaborators.author.email)
              : undefined,
            email: undefined,
          }
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
          ? {
              id: c.user.id,
              pseudo: c.user.pseudo,
              emailHash: c.user.email ? getEmailHash(c.user.email) : undefined,
              email: undefined,
            }
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
      statusMessage: 'Erreur serveur lors de la création de la convention',
    })
  }
})
