export default defineTask({
  meta: {
    name: 'cleanup-empty-conversations',
    description: 'Remove conversations without messages older than 7 days',
  },
  async run({ payload: _payload }) {
    try {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Supprimer les conversations sans messages créées il y a plus de 7 jours
      const deletedConversations = await prisma.conversation.deleteMany({
        where: {
          createdAt: { lt: sevenDaysAgo },
          messages: { none: {} },
        },
      })

      console.log(`[CRON cleanup-empty-conversations] ${deletedConversations.count} supprimées`)

      return {
        success: true,
        conversationsDeleted: deletedConversations.count,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON cleanup-empty-conversations] Erreur:', error)
      throw error
    }
  },
})
