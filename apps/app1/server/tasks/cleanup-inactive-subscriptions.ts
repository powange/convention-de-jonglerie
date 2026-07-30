export default defineTask({
  meta: {
    name: 'cleanup-inactive-subscriptions',
    description: 'Remove push subscriptions inactive for more than 1 month',
  },
  /**
   * Supprime les jetons de notification désactivés depuis plus d'un mois.
   *
   * Un jeton passe à `isActive: false` quand l'utilisateur se désabonne. Le conserver quelque
   * temps permet de le réactiver s'il se réabonne depuis le même appareil ; passé un mois, il
   * n'encombre plus que la table.
   *
   * Les jetons encore actifs ne sont jamais touchés, quelle que soit leur ancienneté : un
   * appareil peu utilisé reste un abonnement valide.
   */
  async run({ payload: _payload }) {
    try {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const deleted = await prisma.fcmToken.deleteMany({
        where: { isActive: false, updatedAt: { lt: oneMonthAgo } },
      })

      console.log(`[CRON cleanup-inactive-subscriptions] ${deleted.count} jeton(s) supprimé(s)`)

      return {
        success: true,
        deleted: deleted.count,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON cleanup-inactive-subscriptions] Erreur:', error)
      throw error
    }
  },
})
