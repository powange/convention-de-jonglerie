// Middleware pour rediriger les utilisateurs connectés
export default defineNuxtRouteMiddleware(async () => {
  // Utiliser le composable useUserSession qui gère automatiquement serveur/client
  const { loggedIn, user } = useUserSession()

  // Attendre que l'état de session soit résolu
  await nextTick()

  if (loggedIn.value && user.value) {
    return navigateTo('/')
  }
})
