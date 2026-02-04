import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    const query = getQuery(event)
    const token = query.token as string

    if (!token) {
      throw createError({
        status: 400,
        message: 'Token manquant',
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
  },
  { operationName: 'VerifyResetToken' }
)
