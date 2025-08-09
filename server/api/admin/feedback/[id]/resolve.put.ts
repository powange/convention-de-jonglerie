import { prisma } from '../../../../utils/prisma';
import { z } from 'zod';
import { validateAndSanitize, handleValidationError } from '../../../../utils/validation-schemas';

const resolveSchema = z.object({
  resolved: z.boolean(),
  adminNotes: z.string().max(2000, 'Les notes admin ne peuvent pas dépasser 2000 caractères').optional()
});

export default defineEventHandler(async (event) => {
  const user = event.context.user;

  // Vérifier que l'utilisateur est admin global
  if (!user || !user.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accès refusé. Droits d\'administrateur requis.'
    });
  }

  const feedbackId = parseInt(event.context.params?.id as string);

  if (isNaN(feedbackId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de feedback invalide'
    });
  }

  const body = await readBody(event);

  // Validation des données
  let validatedData;
  try {
    validatedData = validateAndSanitize(resolveSchema, body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error);
    }
    throw error;
  }

  const { resolved, adminNotes } = validatedData;

  try {
    // Vérifier que le feedback existe
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id: feedbackId }
    });

    if (!existingFeedback) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feedback introuvable'
      });
    }

    // Mettre à jour le feedback
    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        resolved,
        adminNotes,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true
          }
        }
      }
    });

    return {
      success: true,
      message: resolved ? 'Feedback marqué comme résolu' : 'Feedback marqué comme non résolu',
      feedback: updatedFeedback
    };

  } catch (error) {
    console.error('Erreur lors de la mise à jour du feedback:', error);
    
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la mise à jour du feedback'
    });
  }
});