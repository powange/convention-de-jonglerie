import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { registerSchema, handleValidationError } from '../../utils/validation-schemas';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // Validation et sanitisation des données
    const validatedData = registerSchema.parse(body);
    
    // Sanitisation supplémentaire
    const cleanEmail = validatedData.email.toLowerCase().trim();
    const cleanPseudo = validatedData.pseudo.trim();
    const cleanNom = validatedData.nom.trim();
    const cleanPrenom = validatedData.prenom.trim();

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        pseudo: cleanPseudo,
        nom: cleanNom,
        prenom: cleanPrenom,
      },
    });
    
    return { 
      message: 'Utilisateur créé avec succès', 
      user: { 
        id: user.id, 
        email: user.email, 
        pseudo: user.pseudo, 
        nom: user.nom, 
        prenom: user.prenom
      } 
    };
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error);
    }
    
    // Gestion des erreurs Prisma
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') { // Unique constraint failed
        throw createError({
          statusCode: 409,
          statusMessage: 'Email ou pseudo déjà utilisé',
        });
      }
    }
    
    console.error('Erreur lors de l\'inscription:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur interne',
    });
  }
});