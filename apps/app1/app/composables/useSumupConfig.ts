import { ref } from 'vue'

export interface SumupConfigData {
  affiliateKey: string
  appId: string
  updatedAt?: string
}

interface ApiResponse<T> {
  success?: boolean
  data?: T
}

/**
 * Composable pour gérer la configuration SumUp (par édition).
 *
 * SumUp nécessite une `affiliate-key` et un `app-id` côté marchand pour que
 * l'app SumUp Merchant ouvre avec le montant pré-rempli. Ces credentials
 * sont saisis par l'organisateur d'édition et stockés en BDD (clé chiffrée).
 */
export const useSumupConfig = (editionId: number) => {
  const config = ref<SumupConfigData | null>(null)
  const loading = ref(false)
  const updating = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})

  const fetchConfig = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<ApiResponse<{ config: SumupConfigData | null }>>(
        `/api/editions/${editionId}/ticketing/sumup/config`
      )
      config.value = response?.data?.config ?? null
    } catch (e: any) {
      error.value = e?.data?.message || 'Impossible de charger la configuration SumUp'
      config.value = null
    } finally {
      loading.value = false
    }
  }

  const saveConfig = async (data: { affiliateKey: string; appId: string }) => {
    updating.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const response = await $fetch<ApiResponse<{ config: SumupConfigData }>>(
        `/api/editions/${editionId}/ticketing/sumup/config`,
        { method: 'PUT', body: data }
      )
      if (response?.data?.config) {
        config.value = response.data.config
      }
      return response?.data?.config
    } catch (e: any) {
      if (e?.data?.data?.errors) {
        fieldErrors.value = e.data.data.errors
        error.value = e.data.data.message || 'Erreurs de validation'
      } else {
        error.value = e?.data?.message || e?.message || 'Erreur lors de la mise à jour'
      }
      throw e
    } finally {
      updating.value = false
    }
  }

  const deleteConfig = async () => {
    updating.value = true
    error.value = null

    try {
      await $fetch(`/api/editions/${editionId}/ticketing/sumup/config`, {
        method: 'DELETE',
      })
      config.value = null
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || 'Erreur lors de la suppression'
      throw e
    } finally {
      updating.value = false
    }
  }

  return {
    config: readonly(config),
    loading: readonly(loading),
    updating: readonly(updating),
    error: readonly(error),
    fieldErrors: readonly(fieldErrors),
    fetchConfig,
    saveConfig,
    deleteConfig,
  }
}
