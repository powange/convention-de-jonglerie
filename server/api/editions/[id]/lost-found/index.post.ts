import { prisma } from '../../../../utils/prisma';
import { hasEditionEditPermission } from '../../../../utils/permissions';
// Import dynamique pour compat tests/mocks (#imports)

export default defineEventHandler(async (event) => {
  try {
  const { requireUserSession } = await import('#imports')
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID d\'édition invalide',
      });
    }

  // Vérifier l'authentification via la session scellée
  const { user } = await requireUserSession(event)
  const userId = user.id

    // Vérifier que l'édition existe et est terminée
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: {
              include: { user: true }
            }
          }
        }
      }
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée',
      });
    }

    // Vérifier que l'édition est terminée
    const now = new Date();
    if (now <= new Date(edition.endDate)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Les objets trouvés ne peuvent être ajoutés qu\'après la fin de l\'édition',
      });
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId);
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous devez être collaborateur pour ajouter un objet trouvé',
      });
    }

    // Valider les données
    const { description, imageUrl } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'La description est requise',
      });
    }

    // Créer l'objet trouvé
    const lostFoundItem = await prisma.lostFoundItem.create({
      data: {
        editionId,
        userId,
        description: description.trim(),
        imageUrl: imageUrl || null,
        status: 'LOST'
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true
              }
            }
          }
        }
      }
    });

    return lostFoundItem;
  } catch (error: unknown) {
    console.error('Erreur lors de la création de l\'objet trouvé:', error);
    const httpError = error as { statusCode?: number }
    if (httpError?.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    });
  }
});