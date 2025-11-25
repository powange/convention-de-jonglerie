export default defineTask({
  meta: {
    name: 'cleanup-empty-conversations',
    description: 'Remove conversations without messages older than 7 days',
  },
  async run({ payload: _payload }) {
    console.log('🗑️ Exécution de la tâche: nettoyage des conversations vides')

    try {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Trouver les conversations sans messages créées il y a plus de 7 jours
      const emptyConversations = await prisma.conversation.findMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo,
          },
          messages: {
            none: {},
          },
        },
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
      })

      console.log(`🔍 Trouvé ${emptyConversations.length} conversations vides de plus de 7 jours`)

      if (emptyConversations.length === 0) {
        console.log('✅ Tâche terminée: aucune conversation vide à nettoyer')
        return {
          success: true,
          conversationsDeleted: 0,
          timestamp: new Date().toISOString(),
        }
      }

      // Afficher les détails des conversations à supprimer
      const typeStats: Record<string, number> = {}
      for (const conv of emptyConversations) {
        typeStats[conv.type] = (typeStats[conv.type] || 0) + 1
      }

      console.log('📊 Répartition par type:')
      for (const [type, count] of Object.entries(typeStats)) {
        console.log(`   - ${type}: ${count}`)
      }

      // Supprimer les conversations vides (les participants seront supprimés en cascade)
      const deletedConversations = await prisma.conversation.deleteMany({
        where: {
          id: {
            in: emptyConversations.map((c) => c.id),
          },
        },
      })

      console.log(`🗑️ Supprimé ${deletedConversations.count} conversations vides`)

      // Statistiques finales
      const remainingConversations = await prisma.conversation.count()

      console.log(`✅ Tâche terminée: ${deletedConversations.count} conversations vides supprimées`)
      console.log(`📊 Statistiques après nettoyage:`)
      console.log(`   - ${remainingConversations} conversations restantes`)

      return {
        success: true,
        conversationsDeleted: deletedConversations.count,
        typeStats,
        remainingConversations,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des conversations vides:', error)
      throw error
    }
  },
})
