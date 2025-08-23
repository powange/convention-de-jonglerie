import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const token = query.token as string

    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Token manquant',
      })
    }

    // Vérifier le token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return {
        valid: false,
        reason: 'invalid',
      }
    }

    // Vérifier si le token a expiré
    // Comparer en UTC car les dates en BDD sont en UTC
    const nowUTC = new Date()
    const expiresAtUTC = new Date(resetToken.expiresAt)

    if (nowUTC.getTime() > expiresAtUTC.getTime()) {
      return {
        valid: false,
        reason: 'expired',
      }
    }

    // Vérifier si le token a déjà été utilisé
    if (resetToken.used) {
      return {
        valid: false,
        reason: 'used',
      }
    }

    return {
      valid: true,
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Erreur lors de la vérification du token',
    })
  }
})
