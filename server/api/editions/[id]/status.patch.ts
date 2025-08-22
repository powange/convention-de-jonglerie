import { prisma } from '../../../utils/prisma';
import { z } from 'zod';

const statusSchema = z.object({
  isOnline: z.boolean()
});

export default defineEventHandler(async (event) => {
  // Check authentication
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const editionId = parseInt(event.context.params?.id as string);
  
  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID d\'édition invalide',
    });
  }

  // Validate body
  const body = await readBody(event);
  const validatedData = statusSchema.parse(body);

  // Get edition with convention and collaborators
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Édition introuvable',
    });
  }

  // Check permissions
  const userId = event.context.user.id;
  const isCreator = edition.creatorId === userId;
  const isConventionAuthor = edition.convention.authorId === userId;
  const collaboration = edition.convention.collaborators.find(c => c.userId === userId);
  const canManage = isCreator || isConventionAuthor || 
    (collaboration && (collaboration.role === 'ADMINISTRATOR' || collaboration.role === 'MODERATOR'));

  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Vous n\'avez pas la permission de modifier le statut de cette édition',
    });
  }

  // Update edition status
  const updatedEdition = await prisma.edition.update({
    where: { id: editionId },
    data: {
      isOnline: validatedData.isOnline
    },
    include: {
      creator: {
        select: { id: true, pseudo: true }
      },
      convention: {
        include: {
          collaborators: {
            include: {
              user: {
                select: { id: true, pseudo: true, email: true }
              }
            }
          }
        }
      },
      favoritedBy: {
        select: { id: true }
      }
    }
  });

  return updatedEdition;
});