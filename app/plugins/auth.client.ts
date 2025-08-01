import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const authStore = useAuthStore()
    
    // Forcer l'initialisation synchrone au démarrage
    authStore.initializeAuth()
    
    // Configurer l'intercepteur $fetch pour ajouter automatiquement le token
    const nuxtApp = useNuxtApp()
    
    // Override du $fetch pour ajouter les headers d'authentification
    nuxtApp.hook('app:created', () => {
      const originalFetch = globalThis.$fetch
      
      globalThis.$fetch = async (request: any, options: any = {}) => {
        // Ajouter le token aux headers si disponible et si c'est une requête API
        if (authStore.token && typeof request === 'string' && request.startsWith('/api/')) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${authStore.token}`
          }
        }
        
        return originalFetch(request, options)
      }
    })
  }
})