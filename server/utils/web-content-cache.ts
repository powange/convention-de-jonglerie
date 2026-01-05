/**
 * Cache pour le contenu web extrait
 *
 * Évite de refaire des requêtes HTTP pour les mêmes URLs
 * lors de tests multiples ou de retries.
 */

import { AI_TIMEOUTS } from './ai-config'
import { loggers } from './logger'

import type { WebContentExtraction } from './web-content-extractor'

const log = loggers.cache

/**
 * Entrée du cache
 */
interface CacheEntry {
  /** Contenu extrait */
  content: WebContentExtraction
  /** Timestamp de mise en cache */
  timestamp: number
  /** Nombre de hits */
  hits: number
}

/**
 * Statistiques du cache
 */
export interface CacheStats {
  /** Nombre d'entrées en cache */
  size: number
  /** Nombre total de hits */
  totalHits: number
  /** Nombre total de misses */
  totalMisses: number
  /** Ratio de hit */
  hitRatio: number
}

/**
 * Cache en mémoire pour le contenu web
 */
const cache = new Map<string, CacheEntry>()

/**
 * Statistiques globales
 */
let stats = {
  totalHits: 0,
  totalMisses: 0,
}

/**
 * Normalise une URL pour le cache
 * Supprime les fragments et normalise le trailing slash
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Supprimer le fragment
    parsed.hash = ''
    // Normaliser le trailing slash
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Vérifie si une entrée du cache est expirée
 */
function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > AI_TIMEOUTS.WEB_CONTENT_CACHE
}

/**
 * Récupère le contenu depuis le cache
 *
 * @param url - URL à chercher
 * @returns Le contenu caché ou null si non trouvé ou expiré
 */
export function getCachedContent(url: string): WebContentExtraction | null {
  const normalizedUrl = normalizeUrl(url)
  const entry = cache.get(normalizedUrl)

  if (!entry) {
    stats.totalMisses++
    log.debug(`Cache miss: ${normalizedUrl}`)
    return null
  }

  if (isExpired(entry)) {
    cache.delete(normalizedUrl)
    stats.totalMisses++
    log.debug(`Cache expired: ${normalizedUrl}`)
    return null
  }

  entry.hits++
  stats.totalHits++
  log.debug(`Cache hit: ${normalizedUrl} (hits: ${entry.hits})`)
  return entry.content
}

/**
 * Met en cache le contenu extrait
 *
 * @param url - URL source
 * @param content - Contenu extrait
 */
export function setCachedContent(url: string, content: WebContentExtraction): void {
  const normalizedUrl = normalizeUrl(url)

  cache.set(normalizedUrl, {
    content,
    timestamp: Date.now(),
    hits: 0,
  })

  log.debug(`Cached: ${normalizedUrl} (${content.textContent.length} chars)`)

  // Nettoyer les anciennes entrées si le cache devient trop grand
  if (cache.size > 100) {
    cleanupCache()
  }
}

/**
 * Invalide une entrée du cache
 *
 * @param url - URL à invalider
 */
export function invalidateCachedContent(url: string): void {
  const normalizedUrl = normalizeUrl(url)
  if (cache.delete(normalizedUrl)) {
    log.debug(`Invalidated: ${normalizedUrl}`)
  }
}

/**
 * Vide tout le cache
 */
export function clearCache(): void {
  const size = cache.size
  cache.clear()
  stats = { totalHits: 0, totalMisses: 0 }
  log.info(`Cache cleared (${size} entries removed)`)
}

/**
 * Nettoie les entrées expirées du cache
 */
export function cleanupCache(): void {
  const now = Date.now()
  let removed = 0

  for (const [url, entry] of cache.entries()) {
    if (now - entry.timestamp > AI_TIMEOUTS.WEB_CONTENT_CACHE) {
      cache.delete(url)
      removed++
    }
  }

  if (removed > 0) {
    log.info(`Cache cleanup: ${removed} expired entries removed`)
  }
}

/**
 * Retourne les statistiques du cache
 */
export function getCacheStats(): CacheStats {
  const total = stats.totalHits + stats.totalMisses
  return {
    size: cache.size,
    totalHits: stats.totalHits,
    totalMisses: stats.totalMisses,
    hitRatio: total > 0 ? stats.totalHits / total : 0,
  }
}

/**
 * Wrapper pour récupérer du contenu avec cache
 *
 * Si le contenu est en cache, le retourne directement.
 * Sinon, exécute la fonction de fetch et met en cache le résultat.
 *
 * @param url - URL à récupérer
 * @param fetchFn - Fonction pour récupérer le contenu si pas en cache
 *
 * @example
 * const content = await getWithCache(url, async () => {
 *   const html = await fetchPage(url)
 *   return extractWebContent(html, url)
 * })
 */
export async function getWithCache(
  url: string,
  fetchFn: () => Promise<WebContentExtraction>
): Promise<WebContentExtraction> {
  // Essayer le cache d'abord
  const cached = getCachedContent(url)
  if (cached) {
    return cached
  }

  // Récupérer le contenu
  const content = await fetchFn()

  // Mettre en cache
  setCachedContent(url, content)

  return content
}
