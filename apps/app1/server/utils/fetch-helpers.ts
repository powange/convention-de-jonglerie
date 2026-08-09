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
 * Marque posée sur une erreur d'expiration, pour la distinguer d'une machine injoignable.
 *
 * La différence commande le comportement de secours : une adresse qui expire répond — elle est
 * seulement lente — et basculer ne ferait que doubler l'attente. Une adresse injoignable, elle,
 * ne répondra jamais.
 */
export const ERREUR_EXPIRATION = 'ModeleExpire'

/**
 * Appelle un modèle local, en essayant les adresses dans l'ordre jusqu'à ce que l'une réponde.
 *
 * Le modèle tourne sur une machine du réseau : elle s'éteint, redémarre, change d'adresse. Une
 * seconde adresse évite d'aller changer la configuration au moment précis où l'on a besoin du
 * service.
 *
 * On bascule quand une adresse est INUTILISABLE : injoignable, ou joignable mais incapable de
 * servir — typiquement un LM Studio démarré sans modèle chargé, qui répond poliment une erreur.
 * Un serveur sans modèle n'est pas plus utile qu'un serveur éteint.
 *
 * On ne bascule PAS sur une expiration : la première a bien répondu, trop lentement, et réessayer
 * ailleurs doublerait l'attente pour le même verdict.
 */
export async function fetchLocalModelAvecSecours(
  bases: readonly string[],
  chemin: string,
  options: RequestInit,
  timeout: number,
  modelLabel: string,
  // Le défaut couvre une bascule de modèle ; les tests passent 0 pour ne pas attendre pour rien.
  pauseRechargementMs = 3000
): Promise<Response> {
  const adresses = bases.map((b) => b.trim()).filter(Boolean)
  if (adresses.length === 0) {
    throw new Error(`Aucune adresse configurée pour ${modelLabel}.`)
  }

  let derniereErreur: unknown
  for (const [index, base] of adresses.entries()) {
    const derniere = index === adresses.length - 1
    try {
      const url = `${base.replace(/\/+$/, '')}${chemin}`
      let reponse = await fetchLocalModelWithTimeout(url, options, timeout, modelLabel)
      if (reponse.ok) return reponse

      // Le serveur répond mais refuse de servir. On lit le corps une fois : la réponse ne sera
      // pas rendue à l'appelant, et son message est la seule chose exploitable.
      let corps = await reponse.text().catch(() => '')

      // « Aucun modèle chargé » est souvent passager : LM Studio charge à la demande, et décharge
      // un modèle pour en charger un autre quand la mémoire ne permet pas de tenir les deux. Une
      // requête tombant pendant cette bascule trouve la mémoire vide. On laisse le temps de
      // finir avant de conclure — ou de partir vers le secours.
      if (/no models loaded/i.test(corps)) {
        console.warn(
          `[FETCH] ${modelLabel} sans modèle chargé sur ${base}, nouvel essai dans ${pauseRechargementMs} ms`
        )
        await new Promise((resoudre) => setTimeout(resoudre, pauseRechargementMs))
        reponse = await fetchLocalModelWithTimeout(url, options, timeout, modelLabel)
        if (reponse.ok) return reponse
        corps = await reponse.text().catch(() => '')
      }
      derniereErreur = new Error(messageIndisponible(modelLabel, base, reponse.status, corps))
      if (derniere) throw derniereErreur
      console.warn(
        `[FETCH] ${modelLabel} inutilisable sur ${base} (HTTP ${reponse.status}), tentative sur l'adresse de secours`
      )
      continue
    } catch (error: any) {
      derniereErreur = error
      if (error?.[ERREUR_EXPIRATION] === true || derniere) throw error
      console.warn(
        `[FETCH] ${modelLabel} injoignable sur ${base}, tentative sur l'adresse de secours`
      )
    }
  }
  throw derniereErreur
}

/**
 * Traduit un refus du serveur en une phrase qui dit quoi faire.
 *
 * Le cas courant est un LM Studio démarré sans modèle chargé : il répond un JSON d'erreur que
 * l'utilisateur recevait tel quel, accolades comprises.
 */
function messageIndisponible(
  modelLabel: string,
  base: string,
  status: number,
  corps: string
): string {
  if (/no models loaded/i.test(corps)) {
    return (
      `${modelLabel} répond sur ${base} mais aucun modèle n'y est chargé. ` +
      `Chargez-en un depuis son onglet Developer, ou activez le chargement à la demande.`
    )
  }
  const extrait = corps.trim().slice(0, 300)
  return `${modelLabel} a refusé la requête sur ${base} (HTTP ${status})${extrait ? ` : ${extrait}` : ''}`
}

/**
 * Appelle un modèle local (LM Studio, Ollama) en traduisant l'expiration du délai en une erreur
 * exploitable.
 *
 * Sans cela, `fetchWithTimeout` abandonne sans motif et l'utilisateur reçoit le message brut
 * d'undici — « This operation was aborted » — qui ne dit ni ce qui a expiré, ni quoi y faire.
 * Un modèle local lent est pourtant la cause la plus fréquente : à quelques tokens par seconde,
 * une génération dépasse facilement le délai par défaut.
 */
export async function fetchLocalModelWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
  modelLabel: string
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, options, timeout)
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const expiration: Error & { [ERREUR_EXPIRATION]?: boolean } = new Error(
        `${modelLabel} n'a pas répondu dans les ${Math.round(timeout / 1000)} secondes. ` +
          `Le modèle est probablement trop lent pour cette tâche : essayez avec moins d'URLs, ` +
          `un modèle plus rapide, ou augmentez le délai depuis /admin/ai-config.`
      )
      // Marquée plutôt que reconnue au texte : un message se traduit ou se réécrit, un drapeau non.
      expiration[ERREUR_EXPIRATION] = true
      throw expiration
    }

    // Sans cela, une panne de connexion remonte le « fetch failed » d'undici : trois mots qui ne
    // disent ni qui on essayait de joindre, ni où, ni quoi y faire. On nomme les trois.
    const origine = (() => {
      try {
        return new URL(url).origin
      } catch {
        return url
      }
    })()
    const cause = error?.cause?.code || error?.code || error?.message || 'raison inconnue'
    throw new Error(
      `Impossible de joindre ${modelLabel} sur ${origine} (${cause}). ` +
        `Vérifiez qu'il est démarré, qu'un modèle y est chargé, et que l'adresse configurée ` +
        `dans /admin/ai-config est joignable depuis le serveur.`
    )
  }
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
