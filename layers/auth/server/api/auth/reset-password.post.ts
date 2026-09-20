import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { clearUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceByFieldOrFail } from '#server/utils/prisma-helpers'
import { authRateLimiter } from '#server/utils/rate-limiter'
import { passwordSchema } from '#server/utils/validation-schemas'

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema,
})

export default wrapApiHandler(
  async (event) => {
    // Rate limiting
    await authRateLimiter(event)

    const body = await readBody(event)
    const { token, newPassword } = resetPasswordSchema.parse(body)

    // Vérifier le token
    const resetToken = await fetchResourceByFieldOrFail(
      prisma.passwordResetToken,
      { token },
      {
        include: { user: true },
        errorMessage: 'Token de réinitialisation invalide',
        status: 400,
      }
    )

    // Vérifier si le token a expiré
    // Comparer en UTC car les dates en BDD sont en UTC
    const nowUTC = new Date()
    const expiresAtUTC = new Date(resetToken.expiresAt)

    if (nowUTC.getTime() > expiresAtUTC.getTime()) {
      throw createError({
        status: 400,
        message: 'Le token de réinitialisation a expiré',
      })
    }

    // Vérifier si le token a déjà été utilisé
    if (resetToken.used) {
      throw createError({
        status: 400,
        message: 'Ce token a déjà été utilisé',
      })
    }

    // Hasher le nouveau mot de passe (salt rounds 12, harmonisé avec change-password)
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    /**
     * Le mot de passe ET la génération des sessions.
     *
     * Une réinitialisation est demandée par quelqu'un qui a perdu l'accès — ou par quelqu'un qui
     * soupçonne qu'un autre l'a. Incrémenter `sessionVersion` ferme toutes les sessions ouvertes
     * du compte, sur tous les appareils, ce que la seule écriture du mot de passe ne faisait pas.
     */
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    })

    // Invalider TOUS les tokens de reset de cet utilisateur (sécurité + nettoyage BDD)
    // Empêche la réutilisation d'un autre token actif et nettoie les tokens obsolètes.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    })

    // Et la session courante, pour que le navigateur qui vient de réinitialiser reparte propre.
    await clearUserSession(event)

    return createSuccessResponse(null, 'Votre mot de passe a été réinitialisé avec succès')
  },
  { operationName: 'ResetPassword' }
)
