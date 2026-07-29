import { useAuthStore } from '~/stores/auth'

interface PromoState {
  shouldShow: boolean
  isDismissedForSession: boolean
  lastDismissed: number | null
  sessionStartTime: number | null
  isSubscribed: boolean
  permission: NotificationPermission | null
}

const STORAGE_KEY = 'push-notification-promo'
const SESSION_KEY = 'push-promo-session'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 jours en millisecondes
const MIN_SESSION_TIME = 30 * 1000 // 30 secondes minimum avant de montrer la modale

export const usePushNotificationPromo = () => {
  const authStore = useAuthStore()

  const state = reactive<PromoState>({
    shouldShow: false,
    isDismissedForSession: false,
    lastDismissed: null,
    sessionStartTime: null,
    isSubscribed: false,
    permission: null,
  })

  // Support des notifications
  const isSupported = computed(() => {
    if (!import.meta.client) return false
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  })

  // Charger l'état depuis le localStorage et sessionStorage
  const loadState = () => {
    if (!import.meta.client) return

    try {
      // Charger depuis localStorage (persistant entre sessions)
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        state.lastDismissed = parsed.lastDismissed || null
      }

      // Charger depuis sessionStorage (timer global de session)
      const sessionData = sessionStorage.getItem(SESSION_KEY)
      if (sessionData) {
        const parsed = JSON.parse(sessionData)
        state.sessionStartTime = parsed.sessionStartTime || null
        state.isDismissedForSession = parsed.isDismissedForSession || false
      }

      // Charger la permission du navigateur
      state.permission = Notification.permission
    } catch (error) {
      console.warn("Erreur lors du chargement de l'état de la promo push:", error)
    }
  }

  // Vérifier si l'utilisateur a un token FCM actif sur CET appareil
  const checkSubscription = async () => {
    if (!import.meta.client || !authStore.isAuthenticated) return

    try {
      const { getDeviceId } = useDeviceId()
      const deviceId = getDeviceId()

      const response = await $fetch<{ data: { hasActiveToken: boolean } }>(
        '/api/notifications/fcm/check',
        { query: deviceId ? { deviceId } : undefined }
      )
      state.isSubscribed = response.data.hasActiveToken
    } catch (error) {
      console.warn('[PushPromo] Erreur vérification FCM:', error)
      state.isSubscribed = false
    }
  }

  // Sauvegarder l'état dans localStorage et sessionStorage
  const saveState = () => {
    if (!import.meta.client) return

    try {
      // Sauvegarder dans localStorage (persistant)
      const toSave = {
        lastDismissed: state.lastDismissed,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))

      // Sauvegarder dans sessionStorage (timer global)
      const sessionData = {
        sessionStartTime: state.sessionStartTime,
        isDismissedForSession: state.isDismissedForSession,
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
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
    if (state.isSubscribed) {
      return false
    }

    // La permission ne doit pas être refusée définitivement
    if (state.permission === 'denied') {
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

    // Vérifier si le délai minimum de session est écoulé
    if (state.sessionStartTime) {
      const timeSinceSessionStart = Date.now() - state.sessionStartTime
      if (timeSinceSessionStart < MIN_SESSION_TIME) {
        return false
      }
    } else {
      // Pas encore de sessionStartTime, ne pas afficher
      return false
    }

    return true
  }

  // Initialiser le timer de session si nécessaire
  const initSessionTimer = () => {
    if (!import.meta.client) return
    if (!authStore.isAuthenticated) return

    // Si pas encore de timer de session, en créer un
    if (!state.sessionStartTime) {
      state.sessionStartTime = Date.now()
      saveState()
    }
  }

  // Vérifier périodiquement si on peut montrer la modale
  const checkPeriodically = () => {
    if (!import.meta.client) return

    const interval = setInterval(async () => {
      if (!checkShouldShow()) return

      // Dernière vérification auprès du serveur avant d'afficher : l'abonnement a pu être créé
      // depuis un autre onglet, ou la première vérification avoir eu lieu trop tôt. Afficher la
      // modale à un utilisateur déjà abonné est le pire des cas — autant payer un appel de plus.
      await checkSubscription()
      if (!checkShouldShow()) return

      state.shouldShow = true
      clearInterval(interval)
    }, 1000) // Vérifier toutes les secondes

    // Nettoyer l'interval après 1 minute maximum
    setTimeout(() => clearInterval(interval), 60000)
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
    state.isSubscribed = true
    // `lastDismissed` est posé ici aussi, alors que l'utilisateur a accepté et non refusé.
    // C'est un filet : si la vérification d'abonnement venait à échouer (serveur injoignable,
    // token en cours de rotation), on ne harcèlerait pas pendant une semaine quelqu'un qui vient
    // précisément de dire oui. Sans cela, seuls ceux qui REFUSENT bénéficiaient d'une trêve.
    state.lastDismissed = Date.now()
    saveState()
  }

  // Reset pour les tests
  const reset = () => {
    if (!import.meta.client) return

    state.shouldShow = false
    state.isDismissedForSession = false
    state.lastDismissed = null
    state.sessionStartTime = null
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  }

  // Initialisation
  onMounted(() => {
    loadState()

    // La session est hydratée de façon ASYNCHRONE : le plugin auth.client lance
    // `/api/session/me` sans l'attendre. Au montage, `isAuthenticated` est donc encore faux dans
    // la quasi-totalité des cas.
    //
    // La vérification de l'abonnement était lancée ici même : elle sortait aussitôt faute de
    // session, `isSubscribed` restait à false et n'était plus jamais réévalué. La modale
    // s'affichait alors à des utilisateurs déjà abonnés — et comme `markAsEnabled()` ne pose pas
    // `lastDismissed`, ceux qui venaient d'activer les notifications la revoyaient à chaque
    // session, sans la trêve de 7 jours dont bénéficient ceux qui refusent.
    //
    // On attend donc que la session soit là avant d'interroger le serveur.
    // `started` suffit à garantir un seul démarrage : arrêter le watcher depuis son propre
    // callback échouerait, `immediate: true` le déclenchant avant que la fonction d'arrêt existe.
    let started = false
    watch(
      () => authStore.isAuthenticated,
      async (authenticated) => {
        if (!authenticated || started) return
        started = true

        await checkSubscription()
        initSessionTimer()
        checkPeriodically()
      },
      { immediate: true }
    )
  })

  return {
    shouldShow: readonly(toRef(state, 'shouldShow')),
    isSubscribed: readonly(toRef(state, 'isSubscribed')),
    permission: readonly(toRef(state, 'permission')),
    isSupported,
    dismiss,
    markAsEnabled,
    reset,
    checkShouldShow,
    initSessionTimer,
    checkPeriodically,
  }
}
