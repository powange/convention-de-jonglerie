import { setup } from '@nuxt/test-utils'

await setup({
  // Configuration de l'environnement de test Nuxt
  nuxt: {
    // Configuration du serveur de test
    server: {
      port: 3001
    }
  }
})