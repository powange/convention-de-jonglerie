// Empêche les navigations accidentelles du routeur vers des endpoints API (ex: /api/...)
// Cela supprime le warning "No match found for location" lorsque, pour une raison quelconque,
// une navigation client est déclenchée vers une route serveur.
export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  const router = useRouter()
  router.beforeEach((to) => {
    if (to.path.startsWith('/api/')) {
      // On annule la navigation vers les endpoints API (doivent être consommés via $fetch)
      console.warn('[router-api-ignore] Navigation vers endpoint API annulée:', to.path)
      return false // bloque la navigation
    }
  })
})
