import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const authStore = useAuthStore()

    // Intercepter les requêtes avec ofetch hook
    const nuxtApp = useNuxtApp()

    // Créer une instance $fetch personnalisée avec le header admin
    const enhancedFetch = $fetch.create({
      onRequest({ options }) {
        if (authStore.isAdminModeActive) {
          options.headers = {
            ...options.headers,
            'X-Admin-Mode': 'true',
          }
        }
      },
    })

    // Remplacer $fetch global et celui de Nuxt
    globalThis.$fetch = enhancedFetch
    nuxtApp.provide('fetch', enhancedFetch)
  }
})
