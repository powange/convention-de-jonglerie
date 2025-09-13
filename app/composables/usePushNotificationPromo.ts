import { usePushNotifications } from '~/composables/usePushNotifications'
import { useAuthStore } from '~/stores/auth'

interface PromoState {
  shouldShow: boolean
  isDismissedForSession: boolean
  lastDismissed: number | null
}

const STORAGE_KEY = 'push-notification-promo'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 jours en millisecondes
const MIN_SESSION_TIME = 30 * 1000 // 30 secondes minimum avant de montrer la modale

export const usePushNotificationPromo = () => {
  const authStore = useAuthStore()
  const { isSupported, isSubscribed, permission } = usePushNotifications()

  const state = reactive<PromoState>({
    shouldShow: false,
    isDismissedForSession: false,
    lastDismissed: null,
  })

  // Charger l'état depuis le localStorage
  const loadState = () => {
    if (!import.meta.client) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        state.lastDismissed = parsed.lastDismissed || null
      }
    } catch (error) {
      console.warn("Erreur lors du chargement de l'état de la promo push:", error)
    }
  }

  // Sauvegarder l'état dans le localStorage
  const saveState = () => {
    if (!import.meta.client) return

    try {
      const toSave = {
        lastDismissed: state.lastDismissed,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (error) {
      console.warn("Erreur lors de la sauvegarde de l'état de la promo push:", error)
    }
  }

  // Vérifier si on doit montrer la modale
  const checkShouldShow = () => {
    if (!import.meta.client) return false

    // L'utilisateur doit être connecté
    if (!authStore.isAuthenticated) {
      return false
    }

    // Les notifications push doivent être supportées
    if (!isSupported.value) {
      return false
    }

    // L'utilisateur ne doit pas déjà être abonné
    if (isSubscribed.value) {
      return false
    }

    // La permission ne doit pas être refusée définitivement
    if (permission.value === 'denied') {
      return false
    }

    // Ne pas montrer si déjà rejetée pour cette session
    if (state.isDismissedForSession) {
      return false
    }

    // Vérifier si pas rejetée récemment (dans les 7 derniers jours)
    if (state.lastDismissed) {
      const timeSinceLastDismiss = Date.now() - state.lastDismissed
      if (timeSinceLastDismiss < DISMISS_DURATION) {
        return false
      }
    }

    return true
  }

  // Montrer la modale après un délai minimum
  const showWithDelay = (delay: number = MIN_SESSION_TIME) => {
    if (!import.meta.client) return

    setTimeout(() => {
      if (checkShouldShow()) {
        state.shouldShow = true
      }
    }, delay)
  }

  // Marquer comme rejetée
  const dismiss = () => {
    state.shouldShow = false
    state.isDismissedForSession = true
    state.lastDismissed = Date.now()
    saveState()
  }

  // Marquer comme activée
  const markAsEnabled = () => {
    state.shouldShow = false
    state.isDismissedForSession = true
    // Ne pas sauvegarder lastDismissed car l'utilisateur a activé
  }

  // Reset pour les tests
  const reset = () => {
    if (!import.meta.client) return

    state.shouldShow = false
    state.isDismissedForSession = false
    state.lastDismissed = null
    localStorage.removeItem(STORAGE_KEY)
  }

  // Initialisation
  onMounted(() => {
    loadState()

    // Attendre que l'auth store soit initialisé
    watchEffect(() => {
      if (authStore.isAuthenticated !== null) {
        nextTick(() => {
          showWithDelay()
        })
      }
    })
  })

  return {
    shouldShow: readonly(toRef(state, 'shouldShow')),
    dismiss,
    markAsEnabled,
    reset,
    checkShouldShow,
    showWithDelay,
  }
}
