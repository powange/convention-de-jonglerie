import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { getEffectiveAIConfigAsync } from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  scrapeFacebookEvent,
  type FacebookScraperResult,
} from '#server/utils/facebook-event-scraper'
import {
  BROWSER_HEADERS,
  fetchWithBrowserless,
  fetchWithTimeout,
  isBrowserlessAvailable,
} from '#server/utils/fetch-helpers'
import { extractWebContent, type WebContentExtraction } from '#server/utils/web-content-extractor'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

// Timeout pour les requêtes HTTP (en ms)
const URL_FETCH_TIMEOUT = 15000 // 15 secondes par URL

/**
 * Résultat de test pour une URL
 */
export interface UrlTestResult {
  url: string
  success: boolean
  type: 'facebook' | 'website'
  error?: string
  facebookData?: FacebookScraperResult
  webContent?: WebContentExtraction
}

/**
 * Vérifie si une URL est un événement Facebook
 */
function isFacebookEventUrl(url: string): boolean {
  return url.includes('facebook.com/events')
}

/**
 * Teste une URL et retourne les données extraites
 *
 * @param browserlessUrl - service de navigateur sans interface, ou `null` s'il est indisponible
 */
async function testUrl(url: string, browserlessUrl: string | null): Promise<UrlTestResult> {
  try {
    // Utiliser le scraper Facebook pour les événements Facebook
    if (isFacebookEventUrl(url)) {
      console.log(`[TEST-URLS] Scraping Facebook Event: ${url}`)

      const fbEvent = await scrapeFacebookEvent(url)

      if (fbEvent) {
        return {
          url,
          success: true,
          type: 'facebook',
          facebookData: fbEvent,
        }
      } else {
        // Fallback sur le fetch classique si le scraper échoue
        console.log(`[TEST-URLS] Scraper Facebook échoué, fallback sur fetch classique`)
      }
    }

    // Le navigateur d'abord, quand il est là. Ce test partageait le bouton avec une génération
    // qui, elle, passait par browserless : les deux ne lisaient donc pas la même page, et un
    // site rendu côté client — ou gardé par un anti-robot — échouait ici tout en réussissant là.
    let html: string

    if (browserlessUrl) {
      console.log(`[TEST-URLS] Fetching URL via browserless: ${url}`)
      html = await fetchWithBrowserless(browserlessUrl, url, {
        timeout: URL_FETCH_TIMEOUT,
        waitForNetworkIdle: true,
      })
    } else {
      console.log(`[TEST-URLS] Fetching URL: ${url}`)

      const response = await fetchWithTimeout(url, { headers: BROWSER_HEADERS }, URL_FETCH_TIMEOUT)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      html = await response.text()
    }

    // Ne pas tronquer le contenu textuel pour le test (limite très grande)
    const webContent = extractWebContent(html, url, 500000)

    return {
      url,
      success: true,
      type: 'website',
      webContent,
    }
  } catch (error: any) {
    console.error(`[TEST-URLS] Erreur pour ${url}: ${error.message}`)
    return {
      url,
      success: false,
      type: isFacebookEventUrl(url) ? 'facebook' : 'website',
      error: error.message,
    }
  }
}

/**
 * POST /api/admin/test-urls
 * Teste les URLs fournies et retourne les données extraites sans passer par l'IA
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const { urls } = requestSchema.parse(body)

    console.log(`[TEST-URLS] Test de ${urls.length} URL(s)`)

    // La disponibilité se vérifie une fois pour toutes les URLs, et non par URL : le service
    // est le même, et l'interroger cinq fois ne dirait rien de plus.
    const configuredUrl = (await getEffectiveAIConfigAsync()).browserlessUrl
    const browserlessUrl =
      configuredUrl && (await isBrowserlessAvailable(configuredUrl)) ? configuredUrl : null

    console.log(
      browserlessUrl
        ? `[TEST-URLS] Utilisation de browserless: ${browserlessUrl}`
        : '[TEST-URLS] Browserless non disponible, utilisation de fetch simple'
    )

    // Tester chaque URL en parallèle
    const results = await Promise.all(urls.map((url) => testUrl(url, browserlessUrl)))

    return createSuccessResponse({ results })
  },
  { operationName: 'TestUrls' }
)
