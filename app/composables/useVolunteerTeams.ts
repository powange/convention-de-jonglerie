export interface VolunteerTeam {
  id: string
  name: string
  description?: string
  color: string
  maxVolunteers?: number
  createdAt: string
  updatedAt: string
  _count?: {
    timeSlots: number
  }
}

export interface CreateTeamData {
  name: string
  description?: string
  color?: string
  maxVolunteers?: number
}

export type UpdateTeamData = Partial<CreateTeamData>

export function useVolunteerTeams(editionId: number) {
  const { $fetch } = useNuxtApp()

  // État réactif
  const teams = ref<VolunteerTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupérer toutes les équipes
  const fetchTeams = async () => {
    try {
      loading.value = true
      error.value = null
      teams.value = await $fetch(`/api/editions/${editionId}/volunteer-teams`)
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors du chargement des équipes'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Créer une équipe
  const createTeam = async (teamData: CreateTeamData): Promise<VolunteerTeam> => {
    try {
      loading.value = true
      error.value = null
      const newTeam = await $fetch(`/api/editions/${editionId}/volunteer-teams`, {
        method: 'POST',
        body: teamData,
      })
      teams.value.push(newTeam)
      return newTeam
    } catch (err: any) {
      error.value = err.data?.message || "Erreur lors de la création de l'équipe"
      throw err
    } finally {
      loading.value = false
    }
  }

  // Mettre à jour une équipe
  const updateTeam = async (teamId: string, teamData: UpdateTeamData): Promise<VolunteerTeam> => {
    try {
      loading.value = true
      error.value = null
      const updatedTeam = await $fetch(`/api/editions/${editionId}/volunteer-teams/${teamId}`, {
        method: 'PUT',
        body: teamData,
      })
      const index = teams.value.findIndex((t) => t.id === teamId)
      if (index !== -1) {
        teams.value[index] = updatedTeam
      }
      return updatedTeam
    } catch (err: any) {
      error.value = err.data?.message || "Erreur lors de la mise à jour de l'équipe"
      throw err
    } finally {
      loading.value = false
    }
  }

  // Supprimer une équipe
  const deleteTeam = async (teamId: string): Promise<void> => {
    try {
      loading.value = true
      error.value = null
      await $fetch(`/api/editions/${editionId}/volunteer-teams/${teamId}`, {
        method: 'DELETE',
      })
      teams.value = teams.value.filter((t) => t.id !== teamId)
    } catch (err: any) {
      error.value = err.data?.message || "Erreur lors de la suppression de l'équipe"
      throw err
    } finally {
      loading.value = false
    }
  }

  // Charger automatiquement au montage
  onMounted(() => {
    fetchTeams()
  })

  return {
    // État
    teams: readonly(teams),
    loading: readonly(loading),
    error: readonly(error),

    // Actions
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
  }
}
