import { prisma } from '../../utils/prisma';
import crypto from 'crypto';

// Fonction pour calculer le hash MD5 d'un email
const getEmailHash = (email: string): string => {
  return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
};

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
                select: { id: true, email: true, pseudo: true, prenom: true, nom: true, profilePicture: true, updatedAt: true }
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

    // Transformer les emails en emailHash pour préserver l'anonymat
    const transformedEdition = {
      ...edition,
      creator: edition.creator ? {
        ...edition.creator,
        emailHash: getEmailHash(edition.creator.email),
        email: undefined // Retirer l'email de la réponse
      } : null,
      convention: edition.convention ? {
        ...edition.convention,
        collaborators: edition.convention.collaborators?.map(collab => ({
          ...collab,
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined // Retirer l'email de la réponse
          }
        }))
      } : null
    };

    // Nettoyer les propriétés undefined
    if (transformedEdition.creator) {
      delete transformedEdition.creator.email;
    }
    
    if (transformedEdition.convention?.collaborators) {
      transformedEdition.convention.collaborators.forEach(collab => {
        delete collab.user.email;
      });
    }

    return transformedEdition;
  } catch (error) {
    console.error('Erreur API edition:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
