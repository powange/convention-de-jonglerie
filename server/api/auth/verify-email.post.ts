import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { NotificationHelpers } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const verifyEmailSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit contenir uniquement des chiffres'),
})

export default wrapApiHandler(
  async (event) => {
    const body = await readBody(event)

    // Validation des données
    const validatedData = verifyEmailSchema.parse(body)

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

    // Vérifier si l'utilisateur a besoin de créer un mot de passe
    const needsPassword = !user.password

    // Si l'utilisateur a déjà un mot de passe, activer le compte directement
    if (!needsPassword) {
      // Activer le compte
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
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
        message: 'Email vérifié avec succès ! Votre compte est maintenant actif.',
        needsPassword: false,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          pseudo: updatedUser.pseudo,
          nom: updatedUser.nom,
          prenom: updatedUser.prenom,
          isEmailVerified: updatedUser.isEmailVerified,
        },
      }
    }

    // Si l'utilisateur n'a pas de mot de passe, retourner un flag pour la création de mot de passe
    return {
      message: 'Code vérifié avec succès. Veuillez créer votre mot de passe.',
      needsPassword: true,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        nom: user.nom,
        prenom: user.prenom,
      },
    }
  },
  { operationName: 'VerifyEmail' }
)
