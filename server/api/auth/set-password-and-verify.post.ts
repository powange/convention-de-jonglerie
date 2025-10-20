import { NotificationHelpers } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { handleValidationError, passwordSchema } from '@@/server/utils/validation-schemas'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const setPasswordSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit contenir uniquement des chiffres'),
  password: passwordSchema,
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validation des données
    const validatedData = setPasswordSchema.parse(body)

    // Rechercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase().trim() },
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur non trouvé',
      })
    }

    if (user.isEmailVerified) {
      throw createError({
        statusCode: 400,
        message: 'Email déjà vérifié',
      })
    }

    if (!user.emailVerificationCode || !user.verificationCodeExpiry) {
      throw createError({
        statusCode: 400,
        message: 'Aucun code de vérification actif',
      })
    }

    // Vérifier l'expiration
    if (new Date() > user.verificationCodeExpiry) {
      throw createError({
        statusCode: 400,
        message: 'Code de vérification expiré',
      })
    }

    // Vérifier le code
    if (user.emailVerificationCode !== validatedData.code) {
      throw createError({
        statusCode: 400,
        message: 'Code de vérification incorrect',
      })
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Activer le compte et définir le mot de passe
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isEmailVerified: true,
        emailVerificationCode: null,
        verificationCodeExpiry: null,
      },
    })

    // Envoyer une notification de bienvenue
    try {
      await NotificationHelpers.welcome(updatedUser.id)
    } catch (notificationError) {
      // Ne pas faire échouer la vérification si la notification échoue
      console.error("Erreur lors de l'envoi de la notification de bienvenue:", notificationError)
    }

    return {
      message: 'Mot de passe créé avec succès ! Votre compte est maintenant actif.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        pseudo: updatedUser.pseudo,
        nom: updatedUser.nom,
        prenom: updatedUser.prenom,
        isEmailVerified: updatedUser.isEmailVerified,
      },
    }
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error)
    }

    // Re-lancer les erreurs déjà formatées
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Erreur lors de la création du mot de passe:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur interne',
    })
  }
})
