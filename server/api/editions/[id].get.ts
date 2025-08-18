import { prisma } from '../../utils/prisma';
import { getEmailHash } from '../../utils/email-hash';

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
  } catch {
      console.log('Table EditionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
      include: {
        creator: {
          select: { id: true, pseudo: true, profilePicture: true, updatedAt: true, email: true },
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
                    email: true,
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
                select: { id: true, pseudo: true, profilePicture: true, updatedAt: true, email: true }
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

    // Transformer les emails en emailHash
    if (edition) {
      // Transformer creator
      if (edition.creator && edition.creator.email) {
        edition.creator = {
          ...edition.creator,
          emailHash: getEmailHash(edition.creator.email),
          email: undefined
  } as unknown;
      }

      // Transformer les collaborateurs de la convention
      if (edition.convention?.collaborators) {
        edition.convention.collaborators = edition.convention.collaborators.map(collab => ({
          ...collab,
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined
          } as unknown
        }));
      }

      // Transformer les collaborateurs de l'édition
      if (includeCollaborators && edition.collaborators) {
        edition.collaborators = edition.collaborators.map(collab => ({
          ...collab,
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined
          } as unknown
        }));
      }
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
