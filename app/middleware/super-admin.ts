import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((_to) => {
  if (import.meta.client) {
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
      return navigateTo('/login')
    }

    if (!authStore.user?.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Accès refusé - Droits super administrateur requis',
      })
    }
  }
})
