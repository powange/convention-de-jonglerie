import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
      // Avec la destination : sans elle, un administrateur dont la session a expiré se
      // reconnecte et retombe sur l'accueil, à charge pour lui de refaire son chemin.
      const { buildLoginUrl } = useReturnTo()
      return navigateTo(buildLoginUrl(to.fullPath))
    }

    if (!authStore.user?.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: 'Accès refusé - Droits super administrateur requis',
      })
    }
  }
})
