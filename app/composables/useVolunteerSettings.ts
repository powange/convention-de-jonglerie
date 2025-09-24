import { fromDate } from '@internationalized/date'
import { ref } from 'vue'

export interface VolunteerSettings {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  counts: Record<string, number>
  myApplication?: any
  setupStartDate?: string
  teardownEndDate?: string
  askSetup?: boolean
  askTeardown?: boolean
  askDiet?: boolean
  askAllergies?: boolean
  askPets?: boolean
  askMinors?: boolean
  askVehicle?: boolean
  askCompanion?: boolean
  askAvoidList?: boolean
  askSkills?: boolean
  askExperience?: boolean
  askTimePreferences?: boolean
  askTeamPreferences?: boolean
}

export const useVolunteerSettings = (editionId: number) => {
  const settings = ref<VolunteerSettings | null>(null)
  const loading = ref(false)
  const updating = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})

  const fetchSettings = async () => {
    loading.value = true
    error.value = null

    try {
      settings.value = await $fetch<VolunteerSettings>(
        `/api/editions/${editionId}/volunteers/settings`
      )
    } catch (e: any) {
      error.value = e?.data?.message || 'Impossible de charger les paramètres des bénévoles'
      console.error('Failed to fetch volunteer settings:', e)
    } finally {
      loading.value = false
    }
  }

  const updateSettings = async (data: Partial<VolunteerSettings>) => {
    updating.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const response = await $fetch<{ settings: VolunteerSettings }>(
        `/api/editions/${editionId}/volunteers/settings`,
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
      console.error('Failed to update volunteer settings:', e)
      throw e
    } finally {
      updating.value = false
    }
  }

  // Fonction utilitaire pour convertir les données pour le composant des options internes
  const getInternalData = (volunteerTeams: any[] = []) => {
    if (!settings.value) return {}

    return {
      setupStartDate: settings.value.setupStartDate
        ? fromDate(new Date(settings.value.setupStartDate), 'UTC')
        : null,
      teardownEndDate: settings.value.teardownEndDate
        ? fromDate(new Date(settings.value.teardownEndDate), 'UTC')
        : null,
      askSetup: settings.value.askSetup,
      askTeardown: settings.value.askTeardown,
      askDiet: settings.value.askDiet,
      askAllergies: settings.value.askAllergies,
      askPets: settings.value.askPets,
      askMinors: settings.value.askMinors,
      askVehicle: settings.value.askVehicle,
      askCompanion: settings.value.askCompanion,
      askAvoidList: settings.value.askAvoidList,
      askSkills: settings.value.askSkills,
      askExperience: settings.value.askExperience,
      askTimePreferences: settings.value.askTimePreferences,
      askTeamPreferences: settings.value.askTeamPreferences,
      teams: volunteerTeams,
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
    getInternalData,
  }
}
