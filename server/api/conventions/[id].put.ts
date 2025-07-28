import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      });
    }

    const body = await readBody(event);

    // Vérifier que la convention existe et que l'utilisateur est l'auteur
    const existingConvention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
      },
    });

    if (!existingConvention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      });
    }

    if (existingConvention.authorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        message: 'Vous n\'avez pas les droits pour modifier cette convention',
      });
    }

    // Validation des données
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Le nom de la convention est requis',
      });
    }

    if (body.name.trim().length < 3) {
      throw createError({
        statusCode: 400,
        message: 'Le nom doit contenir au moins 3 caractères',
      });
    }

    if (body.name.trim().length > 100) {
      throw createError({
        statusCode: 400,
        message: 'Le nom ne peut pas dépasser 100 caractères',
      });
    }

    if (body.description && body.description.length > 1000) {
      throw createError({
        statusCode: 400,
        message: 'La description ne peut pas dépasser 1000 caractères',
      });
    }

    // Validation de l'URL du logo si fournie
    if (body.logo && body.logo.trim()) {
      try {
        new URL(body.logo.trim());
      } catch {
        throw createError({
          statusCode: 400,
          message: 'L\'URL du logo n\'est pas valide',
        });
      }
    }

    // Mettre à jour la convention
    const updatedConvention = await prisma.convention.update({
      where: {
        id: conventionId,
      },
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        logo: body.logo?.trim() || null,
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
    });

    return updatedConvention;
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la mise à jour de la convention:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la mise à jour de la convention',
    });
  }
});