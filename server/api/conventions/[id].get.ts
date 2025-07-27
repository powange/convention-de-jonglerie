import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(event.context.params?.id as string);

  if (isNaN(conventionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Convention ID',
    });
  }

  try {
    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false;
    try {
      await prisma.conventionCollaborator.findFirst();
      includeCollaborators = true;
    } catch (error) {
      console.log('Table ConventionCollaborator pas encore créée, ignorer les collaborateurs');
    }

    const convention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
      },
      include: {
        creator: {
          select: { id: true, email: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
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

    if (!convention) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Convention not found',
      });
    }

    return convention;
  } catch (error) {
    console.error('Erreur API convention:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
