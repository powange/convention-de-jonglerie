// Middleware `auth-protected` : protège les pages nécessitant une connexion.
// Redirige vers /login si aucune session nuxt-auth-utils n'est active.
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, fetch: fetchSession } = useUserSession()

  // Côté client, forcer un rafraîchissement de session pour éviter un état
  // périmé (ex. après un logout dans un autre onglet).
  if (import.meta.client) {
    try {
      await fetchSession()
    } catch {
      // Ignorer les erreurs de rafraîchissement.
    }
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
