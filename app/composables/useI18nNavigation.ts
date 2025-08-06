/**
 * Composable pour garantir la persistance de la langue lors des navigations
 */
export const useI18nNavigation = () => {
  const { locale } = useI18n()
  const router = useRouter()
  
  /**
   * Navigation avec préservation de la langue
   */
  const navigateToWithLocale = (path: string, options?: any) => {
    // Avec strategy: 'no_prefix', la langue est gérée par cookie
    // donc navigateTo standard devrait suffire
    return navigateTo(path, options)
  }
  
  /**
   * Router push avec préservation de la langue
   */
  const routerPushWithLocale = (path: string) => {
    // Idem, le cookie gère la persistance
    return router.push(path)
  }
  
  /**
   * Redirection complète avec préservation de la langue
   */
  const redirectWithLocale = (url: string) => {
    // Pour les redirections complètes, s'assurer que le cookie est bien défini
    const cookie = useCookie('i18n_redirected')
    cookie.value = locale.value
    
    // Puis rediriger
    window.location.href = url
  }
  
  return {
    navigateToWithLocale,
    routerPushWithLocale,
    redirectWithLocale
  }
}