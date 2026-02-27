import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceByFieldOrFail } from '#server/utils/prisma-helpers'
import { passwordSchema } from '#server/utils/validation-schemas'

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema,
})

export default wrapApiHandler(
  async (event) => {
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

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Mettre à jour le mot de passe de l'utilisateur
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    // Marquer le token comme utilisé
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    })

    return createSuccessResponse(null, 'Votre mot de passe a été réinitialisé avec succès')
  },
  { operationName: 'ResetPassword' }
)
