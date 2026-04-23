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

    // Mettre à jour le mot de passe de l'utilisateur
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    // Invalider TOUS les tokens de reset de cet utilisateur (sécurité + nettoyage BDD)
    // Empêche la réutilisation d'un autre token actif et nettoie les tokens obsolètes.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    })

    // Invalider la session courante : si l'utilisateur était connecté, force la re-authentification.
    // Note : pour invalider également les sessions sur d'autres appareils, implémenter
    // un mécanisme de versionning (User.sessionVersion en BDD + middleware).
    await clearUserSession(event)

    return createSuccessResponse(null, 'Votre mot de passe a été réinitialisé avec succès')
  },
  { operationName: 'ResetPassword' }
)
