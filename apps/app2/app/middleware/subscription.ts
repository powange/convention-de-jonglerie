// Protège les fonctionnalités d'organisation : redirige vers /pricing si l'utilisateur
// n'a pas d'abonnement actif. Utilise useRequestFetch pour transmettre le cookie de
// session lors du rendu côté serveur.
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  try {
    const status = await useRequestFetch()('/api/subscription/status')
    if (!status?.active) {
      return navigateTo('/pricing')
    }
  } catch {
    return navigateTo('/pricing')
  }
})
