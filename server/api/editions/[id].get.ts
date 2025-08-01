import { prisma } from '../../utils/prisma';

export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string);

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
    });
  }

  try {
    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false;
    try {
      await prisma.editionCollaborator.findFirst();
      includeCollaborators = true;
    } catch (error) {
      console.log('Table EditionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
      include: {
        creator: {
          select: { id: true, pseudo: true, profilePicture: true, updatedAt: true },
        },
        favoritedBy: {
          select: { id: true },
        },
        convention: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
        ...(includeCollaborators && {
          collaborators: {
            include: {
              user: {
                select: { id: true, pseudo: true, profilePicture: true, updatedAt: true }
              },
              addedBy: {
                select: { id: true, pseudo: true }
              }
            }
          }
        }),
      },
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Edition not found',
      });
    }

    return edition;
  } catch (error) {
    console.error('Erreur API edition:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
