import { useAuthStore } from '../stores/auth';

export default defineNuxtRouteMiddleware((to, _from) => {
  if (import.meta.client) {
    const authStore = useAuthStore();

    // Ensure auth state is initialized from localStorage if not already authenticated
    if (!authStore.isAuthenticated) {
      authStore.initializeAuth();
    }

    // Vérifier l'expiration du token
    authStore.checkTokenExpiry();

    // If the user is still not authenticated after initialization, redirect to the login page
    if (!authStore.isAuthenticated) {
      // Ajouter le paramètre returnTo pour rediriger après connexion
      const returnTo = to.fullPath;
      return navigateTo(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }
});