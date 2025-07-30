import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères')
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { token, newPassword } = resetPasswordSchema.parse(body)

    // Vérifier le token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!resetToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Token de réinitialisation invalide'
      })
    }

    // Vérifier si le token a expiré
    if (resetToken.expiresAt < new Date()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le token de réinitialisation a expiré'
      })
    }

    // Vérifier si le token a déjà été utilisé
    if (resetToken.used) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Ce token a déjà été utilisé'
      })
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Mettre à jour le mot de passe de l'utilisateur
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword }
    })

    // Marquer le token comme utilisé
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true }
    })

    return {
      message: 'Votre mot de passe a été réinitialisé avec succès'
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 400,
      statusMessage: 'Erreur lors de la réinitialisation du mot de passe'
    })
  }
})