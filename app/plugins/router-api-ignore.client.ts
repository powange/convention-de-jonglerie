// Empêche les navigations accidentelles du routeur vers des endpoints serveur :
// - `/api/...` : endpoints API (doivent passer par $fetch)
// - `/_nuxt`, `/_ipx`, `/_ws`, `/__nuxt` : endpoints internes Nuxt/Vite (HMR, assets, etc.)
// Supprime les warnings "No match found for location" provoqués par le HMR et autres
// mécanismes internes qui sont parfois interceptés par Vue Router.
const SERVER_PREFIXES = ['/_nuxt', '/_ipx', '/_ws', '/__nuxt']

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  const router = useRouter()
  router.beforeEach((to) => {
    if (to.path.startsWith('/api/')) {
      // On annule la navigation vers les endpoints API (doivent être consommés via $fetch)
      console.warn('[router-api-ignore] Navigation vers endpoint API annulée:', to.path)
      return false
    }
    if (SERVER_PREFIXES.some((prefix) => to.path.startsWith(prefix))) {
      // Bloque silencieusement les navigations vers les endpoints internes Nuxt/Vite
      return false
    }
  })
})
