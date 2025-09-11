import { useAuthStore } from '~/stores/auth'

import type { FetchOptions } from 'ofetch'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const authStore = useAuthStore()

    // Hook global pour intercepter les requêtes $fetch
    const nuxtApp = useNuxtApp()
    
    // Remplacer $fetch par notre version qui ajoute le header admin
    const enhancedFetch = $fetch.create({
      onRequest({ options }: { options: FetchOptions }) {
        // Ajouter le header X-Admin-Mode si le mode admin est activé
        if (authStore.isAdminModeActive) {
          if (!options.headers) {
            options.headers = {}
          }
          // Ajouter le header pour indiquer que le mode admin est activé
          ;(options.headers as Record<string, string>)['X-Admin-Mode'] = 'true'
        }
      }
    })

    // Remplacer $fetch global
    nuxtApp.provide('fetch', enhancedFetch)
  }
})