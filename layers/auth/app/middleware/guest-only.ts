// Middleware pour rediriger les utilisateurs connectés
export default defineNuxtRouteMiddleware(async () => {
  // Utiliser le composable useUserSession qui gère automatiquement serveur/client
  const { loggedIn, user, fetch: fetchSession } = useUserSession()

  // IMPORTANT: Forcer un fetch de la session depuis le serveur
  // pour éviter d'utiliser des données cachées après un logout
  if (import.meta.client) {
    try {
      await fetchSession()
    } catch {
      // Ignorer les erreurs de fetch
    }
  }

  // Attendre que l'état de session soit résolu
  await nextTick()

  if (loggedIn.value && user.value) {
    return navigateTo('/')
  }
})
