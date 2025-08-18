import { useAuthStore } from '../stores/auth';

export default defineNuxtRouteMiddleware((to, _from) => {
  if (import.meta.client) {
    const authStore = useAuthStore();

  // Le plugin auth.client.ts a déjà initialisé l'authentification au démarrage
  // Si pas authentifié, rediriger vers login
    if (!authStore.isAuthenticated) {
      // Ajouter le paramètre returnTo pour rediriger après connexion
      const returnTo = to.fullPath;
      return navigateTo(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }
});