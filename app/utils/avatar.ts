// Fonction pour générer des initiales à partir d'un nom/pseudo
const getInitials = (name: string): string => {
  if (!name) return '?'

  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0]?.charAt(0).toUpperCase() || '?'
  }

  return words
    .slice(0, 2)
    .map((word) => word?.charAt(0).toUpperCase() || '')
    .join('')
}

// Fonction pour générer une couleur de fond basée sur le nom
const getBackgroundColor = (name: string): string => {
  const colors = [
    '#EF4444',
    '#F97316',
    '#F59E0B',
    '#84CC16',
    '#22C55E',
    '#10B981',
    '#14B8A6',
    '#06B6D4',
    '#0EA5E9',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#A855F7',
    '#D946EF',
    '#EC4899',
    '#F43F5E',
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]!
}

// Fonction pour générer un avatar SVG avec initiales
const generateInitialsAvatar = (name: string, size: number): string => {
  const initials = getInitials(name)
  const backgroundColor = getBackgroundColor(name)
  const fontSize = Math.floor(size * 0.4)

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${backgroundColor}"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="600">${initials}</text>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const useAvatar = () => {
  const { getImageUrl } = useImageUrl()

  const getUserAvatar = (
    user: {
      id?: number
      emailHash?: string
      profilePicture?: string | null
      updatedAt?: string
      pseudo?: string
    },
    size: number = 80,
    fallbackToInitials: boolean = true
  ) => {
    // Vérification de sécurité
    if (!user) {
      return fallbackToInitials
        ? generateInitialsAvatar('?', size)
        : `https://www.gravatar.com/avatar/default?s=${size}&d=mp`
    }

    // Si l'utilisateur a une photo de profil, l'utiliser avec cache-busting
    if (user.profilePicture) {
      // Si c'est déjà une URL absolue, l'utiliser directement
      if (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://')) {
        return user.profilePicture
      }

      // Utiliser updatedAt comme version pour éviter le cache, sinon timestamp actuel
      const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now()

      // Utiliser getImageUrl pour construire l'URL
      const imageUrl = getImageUrl(user.profilePicture, 'profile', user.id)
      if (!imageUrl) {
        // Si échec du chargement, essayer Gravatar puis initiales
        if (user.emailHash) {
          return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
        }
        return fallbackToInitials && user.pseudo
          ? generateInitialsAvatar(user.pseudo, size)
          : `https://www.gravatar.com/avatar/default?s=${size}&d=mp`
      }

      return `${imageUrl}?v=${version}`
    }

    // Sinon, prioriser Gravatar si disponible
    if (user.emailHash) {
      return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
    }

    // En dernier recours, utiliser les initiales ou l'avatar par défaut
    if (fallbackToInitials && user.pseudo) {
      return generateInitialsAvatar(user.pseudo, size)
    }

    return `https://www.gravatar.com/avatar/default?s=${size}&d=mp`
  }

  return {
    getUserAvatar,
    generateInitialsAvatar,
    getInitials,
  }
}
