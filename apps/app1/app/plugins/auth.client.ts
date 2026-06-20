import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    // On garde l'initialisation du store (UI), mais on n'injecte plus d'Authorization.
    const authStore = useAuthStore()
    authStore.initializeAuth()
  }
})
