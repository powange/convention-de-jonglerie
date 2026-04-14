/**
 * Valide qu'une URL de redirection est sûre (chemin relatif interne uniquement).
 * Prévient les attaques Open Redirect (phishing post-authentification).
 *
 * Une URL est considérée sûre si :
 * - elle commence par `/` mais pas par `//` (protocol-relative URL)
 * - elle ne contient pas `:` (protocol absolu)
 * - elle n'est pas une page d'authentification (pour éviter les boucles)
 *
 * @param returnTo URL candidate fournie par l'utilisateur
 * @param fallback URL de repli (défaut : `/`)
 * @returns URL sûre à utiliser pour la redirection
 */
export function sanitizeReturnTo(
  returnTo: string | null | undefined,
  fallback: string = '/'
): string {
  if (!returnTo || typeof returnTo !== 'string') return fallback

  // Rejeter les URL absolues (http://, https://, //evil.com, etc.)
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback

  // Rejeter les caractères suspects (\ peut être interprété comme / par certains navigateurs)
  if (returnTo.includes('\\')) return fallback

  // Éviter les boucles de redirection sur les pages d'authentification
  if (returnTo.startsWith('/login') || returnTo.startsWith('/auth/')) return fallback

  return returnTo
}
