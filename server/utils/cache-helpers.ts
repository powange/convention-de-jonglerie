/**
 * Helpers pour la gestion du cache
 */

/**
 * Invalide les caches liés aux éditions
 * @param editionId - ID de l'édition (optionnel, pour invalider les caches spécifiques)
 */
export async function invalidateEditionCache(editionId?: number) {
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
}

/**
 * Invalide tous les caches
 */
export async function clearAllCache() {
  const storage = useStorage('cache')
  await storage.clear()
}
