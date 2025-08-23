import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
    })
  }

  try {
    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
      include: {
        convention: {
          include: {
            collaborators: {
              where: {
                userId: event.context.user.id,
                OR: [
                  { canDeleteAllEditions: true },
                  { canDeleteConvention: true },
                  { canEditAllEditions: true },
                ],
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Edition not found',
      })
    }

    // Vérifier les permissions : créateur de l'édition, auteur de la convention, collaborateur, ou admin global
    const isCreator = edition.creatorId === event.context.user.id
    const isConventionAuthor = edition.convention.authorId === event.context.user.id
    const isCollaborator = edition.convention.collaborators.length > 0 // déjà filtré sur droits suffisants
    const isGlobalAdmin = event.context.user.isGlobalAdmin || false

    if (!isCreator && !isConventionAuthor && !isCollaborator && !isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: "Vous n'avez pas les droits pour supprimer cette édition",
      })
    }

    await prisma.edition.delete({
      where: {
        id: editionId,
      },
    })
    return { message: 'Edition deleted successfully' }
  } catch (error: any) {
    // Si c'est déjà une erreur HTTP (createError), on la relance
    if (error.statusCode) {
      throw error
    }
    // Sinon, on transforme en erreur interne
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
