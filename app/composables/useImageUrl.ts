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

    // Si l'URL commence déjà par /api/uploads/, elle est déjà correcte
    if (url.startsWith('/api/uploads/')) {
      return url
    }

    // Convertir toutes les URLs d'uploads vers l'API
    if (url.startsWith('/uploads/')) {
      return `/api${url}`
    }

    // Si l'URL ne commence pas par /, l'ajouter et passer par l'API
    if (!url.startsWith('/')) {
      return `/api/uploads/${url}`
    }

    // Pour toute autre URL relative, la retourner telle quelle
    return url
  }

  return {
    normalizeImageUrl,
  }
}
