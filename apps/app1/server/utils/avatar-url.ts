/**
 * Utilitaire côté serveur pour générer les URLs d'avatars
 */

/**
 * Génère l'URL de l'avatar d'un utilisateur
 * @param user - Utilisateur avec emailHash et profilePicture optionnel
 * @param baseUrl - URL de base du site (pour les URLs absolues)
 * @param size - Taille de l'image Gravatar
 * @returns URL absolue de l'avatar
 */
export function getUserAvatarUrl(
  user: {
    id: number
    emailHash: string
    profilePicture?: string | null
  },
  baseUrl: string,
  size: number = 80
): string {
  // Si l'utilisateur a une photo de profil
  if (user.profilePicture) {
    // Si c'est déjà une URL absolue, l'utiliser directement
    if (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://')) {
      return user.profilePicture
    }

    // Construire l'URL pour le fichier uploadé
    let imagePath: string
    if (user.profilePicture.startsWith('/uploads/')) {
      imagePath = user.profilePicture
    } else {
      imagePath = `/uploads/profiles/${user.id}/${user.profilePicture}`
    }

    // Retourner l'URL absolue
    return `${baseUrl}${imagePath}`
  }

  // Sinon, utiliser Gravatar
  return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
}
