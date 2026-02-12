export interface VolunteerTeam {
  id: string
  name: string
  description?: string
  color: string
  maxVolunteers?: number
  isRequired?: boolean
  isAccessControlTeam?: boolean
  isMealValidationTeam?: boolean
  isVisibleToVolunteers?: boolean
  createdAt: string
  updatedAt: string
  assignedVolunteersCount?: number
  _count?: {
    timeSlots: number
  }
}

export interface CreateTeamData {
  name: string
  description?: string
  color?: string
  maxVolunteers?: number
  isRequired?: boolean
  isAccessControlTeam?: boolean
  isMealValidationTeam?: boolean
  isVisibleToVolunteers?: boolean
}

export type UpdateTeamData = Partial<CreateTeamData>

export function useVolunteerTeams(
  editionId: MaybeRefOrGetter<number | undefined>,
  options?: { leaderOnly?: boolean }
) {
  const { $fetch } = useNuxtApp()

  // État réactif
  const teams = ref<VolunteerTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupérer toutes les équipes
  const fetchTeams = async () => {
    const id = toValue(editionId)
    if (!id) return

    try {
      loading.value = true
      error.value = null

      // Ajouter le paramètre leaderOnly si nécessaire
      const queryParams = options?.leaderOnly ? '?leaderOnly=true' : ''
      teams.value = await $fetch(`/api/editions/${id}/volunteer-teams${queryParams}`)
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors du chargement des équipes'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Créer une équipe
  const createTeam = async (teamData: CreateTeamData): Promise<VolunteerTeam> => {
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null
      const newTeam = await $fetch(`/api/editions/${id}/volunteer-teams`, {
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
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null
      const updatedTeam = await $fetch(`/api/editions/${id}/volunteer-teams/${teamId}`, {
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
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null
      await $fetch(`/api/editions/${id}/volunteer-teams/${teamId}`, {
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
