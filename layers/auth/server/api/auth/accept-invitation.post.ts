import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { setUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { NotificationHelpers } from '#server/utils/notification-service'
import { fetchResourceByFieldOrFail } from '#server/utils/prisma-helpers'
import { authRateLimiter } from '#server/utils/rate-limiter'
import { passwordSchema } from '#server/utils/validation-schemas'

const acceptInvitationSchema = z.object({
  token: z.string(),
  password: passwordSchema,
})

/**
 * Complète une invitation (artiste/bénévole ajouté manuellement) : la personne
 * choisit son mot de passe via le lien reçu par email. On réutilise l'infra
 * `PasswordResetToken`. Contrairement au reset classique, on VALIDE l'email
 * (le clic sur le lien reçu par email prouve la possession de l'adresse) et on
 * connecte automatiquement la personne.
 */
export default wrapApiHandler(
  async (event) => {
    await authRateLimiter(event)

    const body = await readBody(event)
    const { token, password } = acceptInvitationSchema.parse(body)

    // Valider le token (même modèle que le reset de mot de passe)
    const invitationToken = await fetchResourceByFieldOrFail(
      prisma.passwordResetToken,
      { token },
      {
        include: { user: true },
        errorMessage: "Lien d'invitation invalide",
        status: 400,
      }
    )

    // Expiration (comparaison en UTC, dates stockées en UTC)
    const nowUTC = new Date()
    if (nowUTC.getTime() > new Date(invitationToken.expiresAt).getTime()) {
      throw createError({ status: 400, message: "Le lien d'invitation a expiré" })
    }

    if (invitationToken.used) {
      throw createError({ status: 400, message: 'Ce lien a déjà été utilisé' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Définir le mot de passe + activer le compte (email vérifié via le lien).
    const updatedUser = await prisma.user.update({
      where: { id: invitationToken.userId },
      data: {
        password: hashedPassword,
        isEmailVerified: true,
        emailVerificationCode: null,
        verificationCodeExpiry: null,
        lastLoginAt: new Date(),
      },
    })

    // Invalider tous les tokens de cet utilisateur (sécurité + nettoyage BDD).
    await prisma.passwordResetToken.deleteMany({
      where: { userId: invitationToken.userId },
    })

    // Connexion automatique
    await setUserSession(event, {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        pseudo: updatedUser.pseudo,
        nom: updatedUser.nom,
        prenom: updatedUser.prenom,
        phone: updatedUser.phone,
        isGlobalAdmin: updatedUser.isGlobalAdmin,
        isVolunteer: updatedUser.isVolunteer,
        isArtist: updatedUser.isArtist,
        isOrganizer: updatedUser.isOrganizer,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        isEmailVerified: updatedUser.isEmailVerified,
      },
    })

    // Notification de bienvenue (non bloquant)
    try {
      await NotificationHelpers.welcome(updatedUser.id)
    } catch (notificationError) {
      console.error("Erreur lors de l'envoi de la notification de bienvenue:", notificationError)
    }

    return createSuccessResponse(
      {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          pseudo: updatedUser.pseudo,
          nom: updatedUser.nom,
          prenom: updatedUser.prenom,
          isEmailVerified: updatedUser.isEmailVerified,
        },
      },
      'Compte activé avec succès ! Vous êtes maintenant connecté.'
    )
  },
  { operationName: 'AcceptInvitation' }
)
