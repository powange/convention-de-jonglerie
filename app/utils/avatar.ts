import { useGravatar } from './gravatar'

export const useAvatar = () => {
  const { getUserAvatar: getGravatarAvatar } = useGravatar()
  const { normalizeImageUrl } = useImageUrl()

  const getUserAvatar = (
    user: {
      email?: string
      emailHash?: string
      profilePicture?: string | null
      updatedAt?: string
    },
    size: number = 80
  ) => {
    // Vérification de sécurité
    if (!user || (!user.email && !user.emailHash)) {
      return 'https://www.gravatar.com/avatar/default?s=80&d=mp' // URL de fallback
    }

    // Si l'utilisateur a une photo de profil, l'utiliser avec cache-busting
    if (user.profilePicture) {
      // Si c'est déjà une URL absolue, l'utiliser directement
      if (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://')) {
        return user.profilePicture
      }

      // Utiliser updatedAt comme version pour éviter le cache, sinon timestamp actuel
      const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now()

      // Sinon, normaliser l'URL via l'API
      const normalizedUrl = normalizeImageUrl(user.profilePicture)
      if (!normalizedUrl) {
        return 'https://www.gravatar.com/avatar/default?s=80&d=mp'
      }

      return `${normalizedUrl}?v=${version}`
    }

    // Sinon, utiliser Gravatar
    if (user.emailHash) {
      // Utiliser directement le hash MD5 fourni (pour les autres utilisateurs)
      return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
    } else if (user.email) {
      // Calculer le hash MD5 depuis l'email (pour l'utilisateur connecté)
      return getGravatarAvatar(user.email, size)
    }

    return 'https://www.gravatar.com/avatar/default?s=80&d=mp'
  }

  return {
    getUserAvatar,
  }
}
