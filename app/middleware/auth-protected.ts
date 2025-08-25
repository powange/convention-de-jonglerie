import { useAuthStore } from '../stores/auth'

// Middleware amélioré : évite la redirection trop tôt lors d'un refresh (race condition avec initializeAuth)
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const authStore = useAuthStore()

  // 1. Hydratation rapide depuis storage si disponible (synchronement)
  if (!authStore.user) {
    try {
      const stored = localStorage.getItem('authUser') || sessionStorage.getItem('authUser') || null
      if (stored) {
        authStore.user = JSON.parse(stored)
      }
    } catch {
      // ignore parse errors
    }
  }

  // 2. Si toujours pas d'utilisateur, tentative de fetch direct de session (évite d'attendre le plugin)
  if (!authStore.user) {
    try {
      const { user } = await $fetch<{ user: any }>('/api/session/me')
      authStore.user = user
    } catch {
      // ignore, on redirigera si toujours vide
    }
  }

  // 3. Décision finale
  if (!authStore.user) {
    const returnTo = to.fullPath
    return navigateTo(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  }
})
