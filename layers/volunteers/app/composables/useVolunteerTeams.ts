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
  options?: {
    leaderOnly?: boolean
    /**
     * Demander la liste telle qu'un candidat la voit : sans les équipes marquées invisibles aux
     * bénévoles, même si l'on a le droit de les voir. C'est ce qu'il faut au formulaire de
     * candidature, y compris quand un organisateur l'ouvre en aperçu — sinon l'aperçu montrerait
     * ce que le candidat ne verra pas.
     */
    pourCandidature?: boolean
  }
) {
  // État réactif
  const teams = ref<VolunteerTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupérer toutes les équipes
  const fetchTeams = async (): Promise<void> => {
    const id = toValue(editionId)
    if (!id) return

    try {
      loading.value = true
      error.value = null

      // `$fetch` est retypé à la main : lui passer des paramètres de requête fait exploser son
      // inférence sur la table des routes (TS2321, profondeur de pile dépassée). Le contournement
      // est celui déjà employé ailleurs dans le dépôt — on perd la vérification de l'URL, qui de
      // toute façon ne tenait plus dès que celle-ci cesse d'être un littéral connu.
      const recuperer = $fetch as unknown as (
        url: string,
        options?: { query?: Record<string, string | undefined> }
      ) => Promise<VolunteerTeam[]>

      teams.value = await recuperer(`/api/editions/${id}/volunteer-teams`, {
        query: {
          leaderOnly: options?.leaderOnly ? 'true' : undefined,
          pourCandidature: options?.pourCandidature ? 'true' : undefined,
        },
      })
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
      const response = await $fetch(`/api/editions/${id}/volunteer-teams`, {
        method: 'POST',
        body: teamData,
      })
      const newTeam = response.data
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
      const response = await $fetch(`/api/editions/${id}/volunteer-teams/${teamId}`, {
        method: 'PUT',
        body: teamData,
      })
      const updatedTeam = response.data
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

  /**
   * Auto-fetch au montage et quand editionId change.
   *
   * Le rejet est absorbé ici : personne n'attend cette promesse, et une erreur qui s'en échappe
   * interrompt l'hydratation de Vue — la page se fige alors entièrement, menu compris, sur un
   * simple 401. L'échec reste consigné dans `error`, et l'appelant qui attend explicitement
   * `fetchTeams` garde la main pour prévenir l'utilisateur.
   */
  watch(
    () => toValue(editionId),
    (id) => {
      if (id) void fetchTeams().catch(() => {})
    },
    { immediate: true }
  )

  return {
    // État
    teams: shallowReadonly(teams),
    loading: readonly(loading),
    error: readonly(error),

    // Actions
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
  }
}
