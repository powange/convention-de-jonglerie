import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { getJwtSecret } from '../../utils/jwt';
import { handleValidationError } from '../../utils/validation-schemas';
import { authRateLimiter } from '../../utils/rate-limiter';

// Schéma de validation pour le login
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email ou pseudo requis'),
  password: z.string().min(1, 'Mot de passe requis')
});

export default defineEventHandler(async (event) => {
  try {
    // Appliquer le rate limiting
    await authRateLimiter(event);
    
    const body = await readBody(event);
    
    // Validation des données d'entrée
    const { identifier, password } = loginSchema.parse(body);
    
    // Sanitisation : trim des espaces
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    let user = null;

    // Try to find user by email
    user = await prisma.user.findUnique({
      where: {
        email: cleanIdentifier,
      },
    });

    // If not found by email, try to find by pseudo
    if (!user) {
      user = await prisma.user.findUnique({
        where: {
          pseudo: cleanIdentifier,
        },
      });
    }

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Identifiants invalides',
      });
    }

    const isPasswordValid = await bcrypt.compare(cleanPassword, user.password);

    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Identifiants invalides',
      });
    }

    // Vérifier si l'email est vérifié
    if (!user.isEmailVerified) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Email non vérifié. Veuillez vérifier votre email avant de vous connecter.',
        data: {
          requiresEmailVerification: true,
          email: user.email
        }
      });
    }

    // Generate JWT token
  const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });

    return { 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        pseudo: user.pseudo, 
        nom: user.nom, 
        prenom: user.prenom,
        profilePicture: user.profilePicture,
        isGlobalAdmin: user.isGlobalAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isEmailVerified: user.isEmailVerified
      } 
    };
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error);
    }
    
    // Re-lancer les autres erreurs
    throw error;
  }
});
