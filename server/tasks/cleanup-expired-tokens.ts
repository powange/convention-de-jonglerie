import { prisma } from '../utils/prisma'

export default defineTask({
  meta: {
    name: 'cleanup-expired-tokens',
    description: 'Clean up expired authentication tokens',
  },
  async run({ payload }) {
    console.log('🗑️ Exécution de la tâche: nettoyage des tokens expirés')

    try {
      const now = new Date()

      // Nettoyer les tokens de réinitialisation de mot de passe expirés
      const expiredPasswordTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: now,
              },
            },
            {
              used: true,
              createdAt: {
                lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Utilisés depuis plus de 24h
              },
            },
          ],
        },
      })

      console.log(`🗑️ Supprimé ${expiredPasswordTokens.count} tokens de réinitialisation de mot de passe expirés`)

      // Nettoyer les anciennes sessions (si vous en avez dans votre base de données)
      // Note: Nuxt Auth Utils utilise des cookies signés, donc pas forcément stockés en DB
      // Cette section est optionnelle selon votre implémentation

      // Statistiques de nettoyage
      const totalCleaned = expiredPasswordTokens.count

      if (totalCleaned > 0) {
        console.log(`✅ Tâche terminée: ${totalCleaned} tokens expirés supprimés`)
      } else {
        console.log('✅ Tâche terminée: aucun token expiré à nettoyer')
      }

      return {
        success: true,
        passwordResetTokensCleaned: expiredPasswordTokens.count,
        totalCleaned,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des tokens expirés:', error)
      throw error
    }
  },
})