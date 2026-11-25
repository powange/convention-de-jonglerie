// Pages d'administration : un compte administrateur. Le statut lu ici (celui de la session) ne sert
// qu'à l'affichage ; chaque point d'API le revérifie en base (server/utils/administration.ts).
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
  if (!(user.value as { isGlobalAdmin?: boolean } | null)?.isGlobalAdmin) return navigateTo('/')
})
