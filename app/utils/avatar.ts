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

// Interface pour le cache d'images
interface ImageCache {
  [url: string]: {
    status: 'success' | 'error'
    timestamp: number
    fallbackUrl?: string
  }
}

const CACHE_KEY = 'image-load-cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 heures

// Récupérer le cache depuis localStorage
const getCache = (): ImageCache => {
  if (typeof window === 'undefined') return {}
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

// Sauvegarder dans le cache
const setCache = (url: string, status: 'success' | 'error', fallback?: string) => {
  if (typeof window === 'undefined') return
  try {
    const cache = getCache()
    cache[url] = {
      status,
      timestamp: Date.now(),
      fallbackUrl: fallback,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore les erreurs de localStorage (quota dépassé, etc.)
  }
}

// Nettoyer les entrées expirées du cache
const cleanCache = () => {
  if (typeof window === 'undefined') return
  try {
    const cache = getCache()
    const now = Date.now()
    const cleanedCache: ImageCache = {}

    for (const url in cache) {
      const entry = cache[url]
      // Garder seulement les entrées non expirées
      if (entry && now - entry.timestamp <= CACHE_DURATION) {
        cleanedCache[url] = entry
      }
    }

    // Sauvegarder le cache nettoyé
    localStorage.setItem(CACHE_KEY, JSON.stringify(cleanedCache))
  } catch {
    // Ignore les erreurs
  }
}

// Vérifier si une URL est dans le cache et valide
const getCachedStatus = (url: string) => {
  const cache = getCache()
  const cached = cache[url]

  if (!cached) return null

  // Vérifier si le cache n'est pas expiré
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    return null
  }

  return cached
}

export const useAvatar = () => {
  const { getImageUrl } = useImageUrl()

  const getUserAvatar = (
    user: {
      id?: number
      emailHash: string
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
        // Si échec du chargement, utiliser Gravatar
        return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
      }

      // Convertir l'URL relative en URL absolue pour éviter l'optimisation _ipx de Nuxt Image
      let finalUrl = imageUrl
      if (imageUrl.startsWith('/') && typeof window !== 'undefined') {
        finalUrl = `${window.location.origin}${imageUrl}`
      }

      return `${finalUrl}?v=${version}`
    }

    // Sinon, utiliser Gravatar
    return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`
  }

  /**
   * Version avec cache et retry automatique pour les images externes
   * Retourne un objet réactif avec l'URL courante et l'état de chargement
   */
  const getUserAvatarWithCache = (
    user: {
      id?: number
      emailHash: string
      profilePicture?: string | null
      updatedAt?: string
      pseudo?: string
    },
    size: number = 80
  ) => {
    const imageUrl = getUserAvatar(user, size)
    const fallbackUrl = getUserAvatar(
      {
        ...user,
        profilePicture: null, // Force l'utilisation du fallback (Gravatar ou initiales)
      },
      size
    )

    // Détecter si l'URL est une image externe (Google, etc.)
    const isExternalImage =
      imageUrl.startsWith('http://') ||
      (imageUrl.startsWith('https://') &&
        !imageUrl.includes('gravatar.com') &&
        !imageUrl.startsWith('data:'))

    const currentUrl = ref<string>(imageUrl)
    const isLoading = ref(true)
    const hasError = ref(false)

    // Si ce n'est pas une image externe, pas besoin de cache/retry
    if (!isExternalImage) {
      currentUrl.value = imageUrl
      isLoading.value = false
      return { currentUrl, isLoading, hasError }
    }

    // Charger l'image avec cache et retry pour les images externes
    const loadImage = () => {
      // Nettoyer le cache au démarrage
      cleanCache()

      // Vérifier le cache
      const cached = getCachedStatus(imageUrl)
      if (cached) {
        if (cached.status === 'error' && cached.fallbackUrl) {
          currentUrl.value = cached.fallbackUrl
          hasError.value = false
          isLoading.value = false
          return
        }
        if (cached.status === 'success') {
          currentUrl.value = imageUrl
          hasError.value = false
          isLoading.value = false
          return
        }
      }

      // Essayer de charger l'image
      const img = new Image()

      img.onload = () => {
        currentUrl.value = imageUrl
        hasError.value = false
        isLoading.value = false
        setCache(imageUrl, 'success')
      }

      img.onerror = () => {
        // Si l'image échoue, utiliser le fallback
        currentUrl.value = fallbackUrl
        hasError.value = true
        isLoading.value = false
        setCache(imageUrl, 'error', fallbackUrl)
      }

      img.src = imageUrl
    }

    // Lancer le chargement immédiatement côté client
    if (typeof window !== 'undefined') {
      // Utiliser nextTick pour s'assurer que le DOM est prêt, mais sans onMounted
      nextTick(() => {
        loadImage()
      })
    }

    return {
      currentUrl,
      isLoading,
      hasError,
    }
  }

  return {
    getUserAvatar,
    getUserAvatarWithCache,
    generateInitialsAvatar,
    getInitials,
  }
}
