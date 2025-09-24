import { ref, readonly } from 'vue'

import type { ProfileStats } from '~/types'

export const useProfileStats = () => {
  const stats = ref<ProfileStats | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchStats = async () => {
    loading.value = true
    error.value = null

    try {
      stats.value = await $fetch<ProfileStats>('/api/profile/stats')
    } catch (e) {
      error.value = 'Impossible de charger les statistiques'
      console.error('Erreur lors du chargement des statistiques:', e)
    } finally {
      loading.value = false
    }
  }

  // Auto-fetch on first use
  const initialized = ref(false)
  const ensureInitialized = async () => {
    if (!initialized.value) {
      initialized.value = true
      await fetchStats()
    }
  }

  return {
    stats: readonly(stats),
    loading: readonly(loading),
    error: readonly(error),
    fetchStats,
    ensureInitialized,
  }
}
