import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const prisma = new PrismaClient();

const addCollaboratorSchema = z.object({
  userEmail: z.string().email('Email invalide'),
  canEdit: z.boolean().default(true)
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);
    
    // Valider les données
    const { userEmail, canEdit } = addCollaboratorSchema.parse(body);
    
    // Vérifier l'authentification
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '');
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Vérifier que la convention existe et que l'utilisateur est le créateur
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
      select: { id: true, creatorId: true }
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Convention introuvable'
      });
    }

    if (convention.creatorId !== decoded.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Seul le créateur peut ajouter des collaborateurs'
      });
    }

    // Trouver l'utilisateur à ajouter
    const userToAdd = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, email: true, pseudo: true }
    });

    if (!userToAdd) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur introuvable'
      });
    }

    // Vérifier que l'utilisateur n'est pas déjà collaborateur
    const existingCollaborator = await prisma.conventionCollaborator.findUnique({
      where: {
        conventionId_userId: {
          conventionId,
          userId: userToAdd.id
        }
      }
    });

    if (existingCollaborator) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Cet utilisateur est déjà collaborateur'
      });
    }

    // Empêcher le créateur de s'ajouter comme collaborateur
    if (userToAdd.id === decoded.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Vous ne pouvez pas vous ajouter comme collaborateur'
      });
    }

    // Ajouter le collaborateur
    const collaborator = await prisma.conventionCollaborator.create({
      data: {
        conventionId,
        userId: userToAdd.id,
        canEdit,
        addedById: decoded.id
      },
      include: {
        user: {
          select: { id: true, email: true, pseudo: true, prenom: true, nom: true }
        },
        addedBy: {
          select: { id: true, pseudo: true }
        }
      }
    });

    return collaborator;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Erreur lors de l\'ajout du collaborateur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});