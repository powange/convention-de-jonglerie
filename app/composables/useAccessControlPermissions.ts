/**
 * Interface pour les informations du créneau actif de contrôle d'accès
 */
export interface ActiveAccessControlSlot {
  slotId: string
  teamId: string | null
  teamName: string | null
  startDateTime: string
  endDateTime: string
  title: string | null
}

/**
 * Composable pour gérer les permissions de contrôle d'accès
 * Vérifie si l'utilisateur est actuellement en créneau de contrôle d'accès (±15 minutes)
 */
export function useAccessControlPermissions(editionId: MaybeRefOrGetter<number | undefined>) {
  const { $fetch } = useNuxtApp()
  const authStore = useAuthStore()

  // État réactif
  const isActiveAccessControlVolunteer = ref(false)
  const activeSlot = ref<ActiveAccessControlSlot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Vérifie si l'utilisateur est actuellement en créneau actif de contrôle d'accès
   */
  const checkAccessControlStatus = async () => {
    const id = toValue(editionId)
    if (!id || !authStore.isAuthenticated) {
      isActiveAccessControlVolunteer.value = false
      activeSlot.value = null
      return false
    }

    try {
      loading.value = true
      error.value = null

      const response = await $fetch<{
        isActive: boolean
        activeSlot: ActiveAccessControlSlot | null
      }>(`/api/editions/${id}/volunteers/access-control/status`)

      isActiveAccessControlVolunteer.value = response.isActive
      activeSlot.value = response.activeSlot

      return response.isActive
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors de la vérification du statut'
      isActiveAccessControlVolunteer.value = false
      activeSlot.value = null
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Retourne true si l'utilisateur peut accéder au contrôle d'accès actuellement
   */
  const canAccessAccessControl = computed(() => {
    return authStore.isAuthenticated && isActiveAccessControlVolunteer.value
  })

  /**
   * Retourne les minutes restantes avant la fin du créneau
   * ou null si pas en créneau actif
   */
  const minutesRemaining = computed(() => {
    if (!activeSlot.value) return null

    const now = new Date()
    const end = new Date(activeSlot.value.endDateTime)
    const diff = end.getTime() - now.getTime()

    return Math.max(0, Math.floor(diff / 1000 / 60))
  })

  /**
   * Retourne true si le créneau va bientôt se terminer (moins de 15 minutes)
   */
  const isEndingSoon = computed(() => {
    const remaining = minutesRemaining.value
    return remaining !== null && remaining <= 15
  })

  // Vérifier le statut au montage si authentifié
  onMounted(() => {
    if (authStore.isAuthenticated) {
      checkAccessControlStatus()
    }
  })

  // Surveiller les changements d'authentification
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        checkAccessControlStatus()
      } else {
        isActiveAccessControlVolunteer.value = false
        activeSlot.value = null
      }
    }
  )

  return {
    // État
    isActiveAccessControlVolunteer: readonly(isActiveAccessControlVolunteer),
    activeSlot: readonly(activeSlot),
    loading: readonly(loading),
    error: readonly(error),

    // Computed
    canAccessAccessControl,
    minutesRemaining,
    isEndingSoon,

    // Actions
    checkAccessControlStatus,
  }
}
