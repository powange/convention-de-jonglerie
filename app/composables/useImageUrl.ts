/**
 * Composable pour gérer les URLs d'images
 * Utilise l'API pour servir les images en production
 */
export const useImageUrl = () => {
  /**
   * Normalise une URL d'image pour l'affichage
   * Utilise toujours l'API pour servir les images uploadées
   */
  const normalizeImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null

    // Si l'URL est déjà absolue (commence par http), la retourner telle quelle
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    // Si l'URL commence par /uploads/, elle est déjà correcte (servie directement)
    if (url.startsWith('/uploads/')) {
      return url
    }

    // Si l'URL ne commence pas par /, l'ajouter comme upload direct
    if (!url.startsWith('/')) {
      return `/uploads/${url}`
    }

    // Pour toute autre URL relative, la retourner telle quelle
    return url
  }

  return {
    normalizeImageUrl,
  }
}
