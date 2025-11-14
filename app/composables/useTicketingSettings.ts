import { ref } from 'vue'

export interface TicketingSettings {
  allowOnsiteRegistration: boolean
  allowAnonymousOrders: boolean
}

export const useTicketingSettings = (editionId: number) => {
  const settings = ref<TicketingSettings | null>(null)
  const loading = ref(false)
  const updating = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})

  const fetchSettings = async () => {
    loading.value = true
    error.value = null

    try {
      settings.value = await $fetch<TicketingSettings>(
        `/api/editions/${editionId}/ticketing/settings`
      )
    } catch (e: any) {
      error.value = e?.data?.message || 'Impossible de charger les paramètres de billetterie'
      console.error('Failed to fetch ticketing settings:', e)
    } finally {
      loading.value = false
    }
  }

  const updateSettings = async (data: Partial<TicketingSettings>) => {
    updating.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const response = await $fetch<{ settings: TicketingSettings }>(
        `/api/editions/${editionId}/ticketing/settings`,
        {
          method: 'PATCH',
          body: data,
        }
      )

      if (response?.settings) {
        settings.value = response.settings
      }

      return response?.settings
    } catch (e: any) {
      // Gérer les erreurs de validation par champ
      if (e?.data?.data?.errors) {
        fieldErrors.value = e.data.data.errors
        error.value = e.data.data.message || 'Erreurs de validation'
      } else {
        // Erreur générale
        fieldErrors.value = {}
        error.value = e?.data?.message || e?.message || 'Erreur lors de la mise à jour'
      }
      console.error('Failed to update ticketing settings:', e)
      throw e
    } finally {
      updating.value = false
    }
  }

  return {
    settings: readonly(settings),
    loading: readonly(loading),
    updating: readonly(updating),
    error: readonly(error),
    fieldErrors: readonly(fieldErrors),
    fetchSettings,
    updateSettings,
  }
}
