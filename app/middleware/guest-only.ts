// Middleware pour rediriger les utilisateurs connectés
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()

  // Si l'utilisateur est connecté, le rediriger vers l'accueil
  if (authStore.isAuthenticated) {
    return navigateTo('/')
  }
})
