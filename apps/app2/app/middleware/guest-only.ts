// Empêche un utilisateur déjà connecté d'accéder aux pages login/register.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) {
    return navigateTo('/dashboard')
  }
})
