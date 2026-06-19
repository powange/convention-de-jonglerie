// Middleware pour la page verify-email
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()

  // Si l'utilisateur est connecté ET son email est déjà vérifié,
  // le rediriger vers l'accueil
  if (authStore.isAuthenticated && authStore.user?.isEmailVerified) {
    return navigateTo('/')
  }
})
