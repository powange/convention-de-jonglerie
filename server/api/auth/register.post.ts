import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { registerSchema, handleValidationError } from '../../utils/validation-schemas';
import { sendEmail, generateVerificationCode, generateVerificationEmailHtml } from '../../utils/emailService';
import { registerRateLimiter } from '../../utils/rate-limiter';
import { createFutureDate, TOKEN_DURATIONS } from '../../utils/date-utils';

export default defineEventHandler(async (event) => {
  try {
    // Appliquer le rate limiting
    await registerRateLimiter(event);
    
    const body = await readBody(event);
    
    // Validation et sanitisation des données
    const validatedData = registerSchema.parse(body);
    
    // Sanitisation supplémentaire
    const cleanEmail = validatedData.email.toLowerCase().trim();
    const cleanPseudo = validatedData.pseudo.trim();
    const cleanNom = validatedData.nom.trim();
    const cleanPrenom = validatedData.prenom.trim();

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // Générer le code de vérification
    const verificationCode = generateVerificationCode();
    const verificationExpiry = createFutureDate(TOKEN_DURATIONS.EMAIL_VERIFICATION);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        pseudo: cleanPseudo,
        nom: cleanNom,
        prenom: cleanPrenom,
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        verificationCodeExpiry: verificationExpiry,
      },
    });
    
    // Envoyer l'email de vérification
    const emailHtml = generateVerificationEmailHtml(verificationCode, cleanPrenom);
    const emailSent = await sendEmail({
      to: cleanEmail,
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: emailHtml,
      text: `Bonjour ${cleanPrenom}, votre code de vérification est : ${verificationCode}`
    });
    
    if (!emailSent) {
      console.warn(`Échec de l'envoi d'email pour ${cleanEmail}`);
    }
    
    return { 
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      requiresVerification: true,
      email: cleanEmail
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