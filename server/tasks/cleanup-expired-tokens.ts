export default defineTask({
  meta: {
    name: 'cleanup-expired-tokens',
    description: 'Clean up expired authentication tokens',
  },
  async run({ payload: _payload }) {
    try {
      const now = new Date()

      // Nettoyer les tokens de réinitialisation de mot de passe expirés
      const expiredPasswordTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { used: true, createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          ],
        },
      })

      console.log(`[CRON cleanup-expired-tokens] ${expiredPasswordTokens.count} tokens supprimés`)

      return {
        success: true,
        passwordResetTokensCleaned: expiredPasswordTokens.count,
        totalCleaned: expiredPasswordTokens.count,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON cleanup-expired-tokens] Erreur:', error)
      throw error
    }
  },
})
