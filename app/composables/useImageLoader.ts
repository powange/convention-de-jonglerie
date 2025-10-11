import { ref, onMounted } from 'vue'

interface ImageCache {
  [url: string]: {
    status: 'success' | 'error'
    timestamp: number
    fallbackUrl?: string
  }
}

const CACHE_KEY = 'image-load-cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 heures

/**
 * Composable pour charger des images avec retry et fallback automatique
 * Gère le cache pour éviter les requêtes répétées aux URLs qui échouent
 */
export const useImageLoader = (imageUrl: string, fallbackUrl: string) => {
  const currentUrl = ref<string>(imageUrl)
  const isLoading = ref(true)
  const hasError = ref(false)

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
        // Garder seulement les entrées non expirées
        if (now - cache[url].timestamp <= CACHE_DURATION) {
          cleanedCache[url] = cache[url]
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

  // Charger l'image avec retry et fallback
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

  onMounted(() => {
    loadImage()
  })

  return {
    currentUrl,
    isLoading,
    hasError,
  }
}
