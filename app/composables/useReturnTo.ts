// Composable pour gérer les URLs de retour sans boucles
export const useReturnTo = () => {
  /**
   * Nettoie une URL pour éviter les boucles de returnTo
   * @param route - Route ou URL à nettoyer
   * @returns URL nettoyée sans paramètres returnTo imbriqués
   */
  const cleanReturnTo = (route: any): string => {
    // Si c'est un objet route
    if (route && typeof route === 'object' && route.path) {
      const cleanQuery = { ...route.query }
      delete cleanQuery.returnTo // Supprimer tout returnTo existant

      const queryString =
        Object.keys(cleanQuery).length > 0
          ? '?' + new URLSearchParams(cleanQuery as Record<string, string>).toString()
          : ''
      return route.path + queryString
    }

    // Si c'est une string URL
    if (typeof route === 'string') {
      try {
        const url = new URL(route, 'http://localhost') // Base pour parser les chemins relatifs
        url.searchParams.delete('returnTo')
        return url.pathname + url.search
      } catch {
        // Si l'URL est invalide, retourner telle quelle
        return route
      }
    }

    return route || '/'
  }

  /**
   * Vérifie si une URL pointe vers une page d'authentification
   * @param url - URL à vérifier
   * @returns true si c'est une page d'auth
   */
  const isAuthPage = (url: string): boolean => {
    const authPages = [
      '/login',
      '/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/verify-email',
      '/logout',
    ]
    return authPages.some((page) => url.startsWith(page))
  }

  /**
   * Construit une URL de login avec returnTo propre
   * @param returnTo - URL de retour
   * @returns URL de login complète
   */
  const buildLoginUrl = (returnTo: string): string => {
    const cleanUrl = cleanReturnTo(returnTo)

    // Ne pas rediriger vers des pages d'auth
    if (isAuthPage(cleanUrl)) {
      return '/login'
    }

    return `/login?returnTo=${encodeURIComponent(cleanUrl)}`
  }

  return {
    cleanReturnTo,
    isAuthPage,
    buildLoginUrl,
  }
}
