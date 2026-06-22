/**
 * Headers HTTP pour simuler un vrai navigateur.
 * Nécessaire pour accéder à certains sites (Facebook, etc.) qui bloquent les requêtes basiques.
 */
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Fetch avec timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch une URL avec les headers de navigateur et un timeout
 */
export async function fetchWithBrowserHeaders(url: string, timeout: number): Promise<Response> {
  return fetchWithTimeout(url, { headers: BROWSER_HEADERS }, timeout)
}

/**
 * Réponse du service browserless /content
 */
export interface BrowserlessContentResponse {
  data: string // HTML rendu
}

/**
 * Options pour le scraping via browserless
 */
export interface BrowserlessOptions {
  /** Timeout en ms (défaut: 30000) */
  timeout?: number
  /** Attendre le réseau inactif (défaut: true) */
  waitForNetworkIdle?: boolean
  /** Sélecteur CSS à attendre avant de récupérer le contenu */
  waitForSelector?: string
}

/**
 * Récupère le HTML rendu d'une page via browserless (avec JavaScript exécuté).
 * Utilise le endpoint /content de browserless/chrome.
 *
 * @param browserlessUrl - URL de base du service browserless (ex: http://192.168.0.13:3001)
 * @param targetUrl - URL de la page à scraper
 * @param options - Options de scraping
 * @returns Le HTML complet de la page après exécution du JavaScript
 */
export async function fetchWithBrowserless(
  browserlessUrl: string,
  targetUrl: string,
  options: BrowserlessOptions = {}
): Promise<string> {
  const { timeout = 30000, waitForNetworkIdle = true, waitForSelector } = options

  // Construire le body de la requête browserless
  // Documentation: https://www.browserless.io/docs/content
  const requestBody: Record<string, unknown> = {
    url: targetUrl,
    // Attendre que le réseau soit inactif pour s'assurer que le JS est chargé
    gotoOptions: {
      waitUntil: waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
      timeout,
    },
  }

  // Ajouter le sélecteur à attendre si spécifié
  if (waitForSelector) {
    requestBody.waitForSelector = {
      selector: waitForSelector,
      timeout,
    }
  }

  const response = await fetchWithTimeout(
    `${browserlessUrl}/content`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    },
    timeout + 5000 // Ajouter 5s de marge pour la requête HTTP elle-même
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Browserless error (${response.status}): ${errorText}`)
  }

  // Le endpoint /content retourne directement le HTML
  const html = await response.text()
  return html
}

/**
 * Vérifie si le service browserless est disponible
 */
export async function isBrowserlessAvailable(browserlessUrl: string): Promise<boolean> {
  if (!browserlessUrl) return false

  try {
    const response = await fetchWithTimeout(
      `${browserlessUrl}/json/version`,
      { method: 'GET' },
      5000
    )
    return response.ok
  } catch {
    return false
  }
}
