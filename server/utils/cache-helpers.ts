/**
 * Helpers pour la gestion du cache
 */

/**
 * Invalide les caches liés aux éditions
 * @param editionId - ID de l'édition (optionnel, pour invalider les caches spécifiques)
 */
export async function invalidateEditionCache(editionId?: number) {
  // En environnement de test, useStorage peut ne pas être disponible
  try {
    const storage = useStorage('cache')

    await Promise.all([
      storage.removeItem('sitemap:editions'),
      storage.removeItem('sitemap:carpool'),
      storage.removeItem('sitemap:volunteers'),
      storage.removeItem('countries:list'),
    ])

    if (editionId) {
      // Invalider les caches spécifiques à l'édition
      await storage.removeItem(`ticketing:stats:order-sources:${editionId}`)
    }
  } catch (error) {
    // Ignorer l'erreur en environnement de test
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Cache invalidation failed:', error)
    }
  }
}

/**
 * Invalide tous les caches
 */
export async function clearAllCache() {
  try {
    const storage = useStorage('cache')
    await storage.clear()
  } catch (error) {
    // Ignorer l'erreur en environnement de test
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Cache clearing failed:', error)
    }
  }
}
