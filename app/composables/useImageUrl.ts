/**
 * Composable pour gérer les URLs d'images
 * Gère la construction des URLs depuis les noms de fichiers stockés en DB
 */
export const useImageUrl = () => {
  /**
   * Génère l'URL complète pour une image depuis un nom de fichier
   * @param filename - Nom de fichier stocké en DB
   * @param type - Type d'entité (convention, edition, profile, etc.)
   * @param entityId - ID de l'entité
   * @returns URL complète pour l'image
   */
  const getImageUrl = (
    filename: string | null | undefined,
    type: 'convention' | 'edition' | 'show' | 'profile' | 'lost-found' = 'convention',
    entityId?: number
  ): string | null => {
    if (!filename) {
      return null
    }

    // Si c'est déjà une URL complète (rétrocompatibilité)
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename
    }

    // Si c'est déjà un path /uploads/ (rétrocompatibilité)
    if (filename.startsWith('/uploads/')) {
      return filename
    }

    // Construire l'URL selon le type d'entité
    switch (type) {
      case 'convention':
        return entityId
          ? `/uploads/conventions/${entityId}/${filename}`
          : `/uploads/temp/${filename}`
      case 'edition':
        return entityId ? `/uploads/editions/${entityId}/${filename}` : `/uploads/temp/${filename}`
      case 'show':
        return entityId ? `/uploads/shows/${entityId}/${filename}` : `/uploads/temp/${filename}`
      case 'profile':
        return entityId ? `/uploads/profiles/${entityId}/${filename}` : `/uploads/temp/${filename}`
      case 'lost-found':
        return entityId
          ? `/uploads/lost-found/${entityId}/${filename}`
          : `/uploads/temp/${filename}`
      default:
        // Fallback générique
        return `/uploads/${filename}`
    }
  }

  /**
   * Version legacy pour compatibilité ascendante
   * @param url - URL ou nom de fichier
   * @returns URL complète
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
    getImageUrl,
    normalizeImageUrl, // Garder pour compatibilité
  }
}
