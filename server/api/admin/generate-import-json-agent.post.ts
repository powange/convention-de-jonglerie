import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import {
  AI_TIMEOUTS,
  getEffectiveAIConfig,
  getMaxContentSizeForProvider,
} from '@@/server/utils/ai-config'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import {
  createTask,
  runTaskInBackground,
  updateTaskMetadata,
  updateTaskStatus,
} from '@@/server/utils/async-tasks'
import {
  extractEditionFeatures,
  mergeFeaturesIntoJson,
} from '@@/server/utils/edition-features-extractor'
import {
  scrapeFacebookEvent,
  facebookEventToImportJson,
  type FacebookScraperResult,
} from '@@/server/utils/facebook-event-scraper'
import { BROWSER_HEADERS, fetchWithTimeout } from '@@/server/utils/fetch-helpers'
import {
  type ProgressCallback,
  sendProgressEvent,
  sendStepEvent,
  sendUrlFetchedEvent,
} from '@@/server/utils/import-generation-sse'
import {
  generateAgentSystemPrompt,
  generateCompactAgentSystemPrompt,
  generateForceGenerationPrompt,
  PROMPT_COMPLETE_PREFILLED_JSON,
} from '@@/server/utils/import-json-schema'
import {
  isJugglingEdgeEventUrl,
  scrapeJugglingEdgeEvent,
  jugglingEdgeEventToImportJson,
  formatJugglingEdgeDataAsContent,
} from '@@/server/utils/jugglingedge-scraper'
import { extractWebContent, formatExtractionForAI } from '@@/server/utils/web-content-extractor'
import { z } from 'zod'

import { generateImportJson } from './generate-import-json.post'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

const MAX_AGENT_ITERATIONS = 4 // Maximum de pages à explorer

// Limites par défaut (seront ajustées dynamiquement selon le context length)
const DEFAULT_MAX_TOTAL_CONTENT_SIZE = 10000
const DEFAULT_MAX_PAGE_CONTENT_SIZE = 2500

// Type pour le résultat de la génération
export interface AgentGenerateResult {
  success: boolean
  json: string
  provider: string
  urlsProcessed: string[]
  iterations: number
}

// Type pour les logs d'exploration
export interface AgentLog {
  iteration: number
  action: string
  url?: string
  message: string
  timestamp: Date
}

/**
 * Extrait les heures du contenu texte et les ajoute aux dates si absentes
 * Recherche des patterns comme "10h", "10:00", "à partir de 14h", "ouverture 9h30"
 * Cherche aussi des patterns spécifiques pour début/fin de convention
 */
function extractAndApplyTimeFromContent(parsedJson: any, collectedContent: string[]): void {
  // Si les dates contiennent déjà des heures (format avec T), ne rien faire
  const startDate = parsedJson.edition?.startDate || ''
  const endDate = parsedJson.edition?.endDate || ''

  const startHasTime = startDate.includes('T')
  const endHasTime = endDate.includes('T')

  if (startHasTime && endHasTime) {
    console.log('[AGENT] Dates contiennent déjà des heures, pas de modification')
    return
  }

  // Chercher les heures dans le contenu
  const fullContent = collectedContent.join(' ').toLowerCase()
  console.log(`[AGENT] Recherche d'heures dans ${fullContent.length} caractères de contenu`)

  // Extraire un échantillon du contenu pour le log (premiers 500 caractères)
  console.log(`[AGENT] Extrait du contenu: ${fullContent.substring(0, 500).replace(/\n/g, ' ')}...`)

  // Patterns spécifiques pour les heures de début de convention
  const startTimePatterns = [
    // "ouverture vendredi à 18h" / "ouverture le vendredi à 18h"
    /ouverture\s+(?:le\s+)?(?:vendredi|samedi|dimanche|jeudi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    // "début vendredi 18h" / "début à 14h"
    /d[eé]but\s+(?:le\s+)?(?:vendredi|samedi|dimanche|jeudi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    // "à partir de 10h"
    /[àa]\s*partir\s+de\s+(\d{1,2})[h:](\d{2})?/gi,
    // "dès 10h" / "dès 10:00"
    /d[eè]s\s+(\d{1,2})[h:](\d{2})?/gi,
    // "from 10am" / "from 2pm"
    /from\s+(\d{1,2})\s*(?:am|pm|h)/gi,
    // "accueil à partir de 14h"
    /accueil\s+(?:à\s+partir\s+de\s+)?(\d{1,2})[h:](\d{2})?/gi,
  ]

  // Patterns spécifiques pour les heures de fin de convention
  const endTimePatterns = [
    // "fermeture dimanche à 18h"
    /fermeture\s+(?:le\s+)?(?:dimanche|samedi|lundi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    // "fin dimanche 18h" / "fin à 18h"
    /fin\s+(?:le\s+)?(?:dimanche|samedi|lundi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    // "jusqu'à 18h"
    /jusqu['']?\s*[àa]\s*(\d{1,2})[h:](\d{2})?/gi,
    // "clôture à 17h"
    /cl[oô]ture\s+(?:à|a)?\s*(\d{1,2})[h:](\d{2})?/gi,
  ]

  // Patterns génériques pour les heures (fallback)
  const genericTimePatterns = [
    // "10h", "10h30", "10:30"
    /(\d{1,2})[h:](\d{2})/g,
    // "10h" seul
    /(\d{1,2})h(?!\d)/g,
  ]

  // Fonction pour extraire une heure depuis un match
  const extractTime = (match: RegExpExecArray): string | null => {
    const hours = parseInt(match[1], 10)
    const minutes = match[2] ? parseInt(match[2], 10) : 0

    // Valider l'heure (entre 6h et 23h pour une convention)
    if (hours >= 6 && hours <= 23 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
    }
    return null
  }

  // Chercher l'heure de début
  let foundStartTime: string | null = null
  if (!startHasTime) {
    for (const pattern of startTimePatterns) {
      pattern.lastIndex = 0 // Reset le pattern
      const match = pattern.exec(fullContent)
      if (match) {
        foundStartTime = extractTime(match)
        if (foundStartTime) {
          console.log(`[AGENT] Heure de début trouvée avec pattern spécifique: ${foundStartTime}`)
          break
        }
      }
    }
  }

  // Chercher l'heure de fin
  let foundEndTime: string | null = null
  if (!endHasTime) {
    for (const pattern of endTimePatterns) {
      pattern.lastIndex = 0 // Reset le pattern
      const match = pattern.exec(fullContent)
      if (match) {
        foundEndTime = extractTime(match)
        if (foundEndTime) {
          console.log(`[AGENT] Heure de fin trouvée avec pattern spécifique: ${foundEndTime}`)
          break
        }
      }
    }
  }

  // Fallback: chercher toutes les heures génériques si pas trouvé avec patterns spécifiques
  if (!foundStartTime || !foundEndTime) {
    const allTimes: string[] = []
    for (const pattern of genericTimePatterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(fullContent)) !== null) {
        const time = extractTime(match)
        if (time && !allTimes.includes(time)) {
          allTimes.push(time)
        }
      }
    }

    if (allTimes.length > 0) {
      // Trier les heures
      allTimes.sort()
      console.log(`[AGENT] Heures génériques trouvées: ${allTimes.join(', ')}`)

      // Utiliser la plus tôt pour le début (si pas déjà trouvée)
      if (!foundStartTime && !startHasTime) {
        // Prendre une heure raisonnable pour un début (entre 8h et 14h de préférence)
        const earlyTimes = allTimes.filter((t) => {
          const h = parseInt(t.split(':')[0], 10)
          return h >= 8 && h <= 14
        })
        foundStartTime = earlyTimes[0] || allTimes[0]
        console.log(`[AGENT] Heure de début (fallback): ${foundStartTime}`)
      }

      // Utiliser la plus tardive pour la fin (si pas déjà trouvée)
      if (!foundEndTime && !endHasTime) {
        // Prendre une heure raisonnable pour une fin (entre 16h et 22h de préférence)
        const lateTimes = allTimes.filter((t) => {
          const h = parseInt(t.split(':')[0], 10)
          return h >= 16 && h <= 22
        })
        foundEndTime = lateTimes[lateTimes.length - 1] || allTimes[allTimes.length - 1]
        console.log(`[AGENT] Heure de fin (fallback): ${foundEndTime}`)
      }
    }
  }

  // Appliquer les heures trouvées
  if (foundStartTime && startDate && !startHasTime) {
    parsedJson.edition.startDate = `${startDate}T${foundStartTime}`
    console.log(`[AGENT] startDate enrichie: ${parsedJson.edition.startDate}`)
  } else if (!startHasTime && startDate) {
    console.log("[AGENT] Pas d'heure de début trouvée, date non modifiée")
  }

  if (foundEndTime && endDate && !endHasTime) {
    parsedJson.edition.endDate = `${endDate}T${foundEndTime}`
    console.log(`[AGENT] endDate enrichie: ${parsedJson.edition.endDate}`)
  } else if (!endHasTime && endDate) {
    console.log("[AGENT] Pas d'heure de fin trouvée, date non modifiée")
  }
}

// Choix du prompt selon le provider IA
// - Modèles locaux (LM Studio, Ollama) : prompt compact pour contexte limité (4k tokens)
// - Anthropic : prompt complet avec tous les détails
function getSystemPrompt(aiProvider: string): string {
  if (aiProvider === 'anthropic') {
    return generateAgentSystemPrompt()
  }
  // Pour LM Studio et Ollama, utiliser le prompt compact
  return generateCompactAgentSystemPrompt()
}

/**
 * Appelle le LLM et parse la réponse de l'agent
 */
async function callAgentLLM(
  config: any,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ action: 'fetch' | 'generate'; url?: string; json?: string }> {
  const aiProvider = config.aiProvider || 'lmstudio'

  console.log(`[AGENT] Provider IA configuré: ${aiProvider}`)

  let responseText: string

  if (aiProvider === 'lmstudio') {
    const response = await fetchWithTimeout(
      `${config.lmstudioBaseUrl || 'http://localhost:1234'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.lmstudioTextModel || config.lmstudioModel || 'auto',
          messages: [{ role: 'system', content: systemPrompt }, ...conversationHistory],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      },
      AI_TIMEOUTS.LLM_REQUEST
    )

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.statusText}`)
    }

    const data = await response.json()
    responseText = data.choices?.[0]?.message?.content || ''
  } else if (aiProvider === 'anthropic') {
    if (!config.anthropicApiKey) {
      throw new Error(
        `Provider 'anthropic' configuré mais ANTHROPIC_API_KEY manquante. Vérifiez votre .env ou utilisez AI_PROVIDER=lmstudio`
      )
    }
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: config.anthropicApiKey,
      timeout: AI_TIMEOUTS.LLM_REQUEST,
    })

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('')
  } else if (aiProvider === 'ollama') {
    const response = await fetchWithTimeout(
      `${config.ollamaBaseUrl || 'http://localhost:11434'}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'llama3',
          prompt: `${systemPrompt}\n\n${conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}`,
          stream: false,
        }),
      },
      AI_TIMEOUTS.LLM_REQUEST
    )

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const data = await response.json()
    responseText = data.response || ''
  } else {
    throw new Error(
      `Provider IA non supporté: ${aiProvider}. Providers valides: lmstudio, anthropic, ollama`
    )
  }

  console.log(`[AGENT] Réponse LLM: ${responseText.substring(0, 200)}...`)

  // Parser la réponse
  if (responseText.includes('FETCH_URL:')) {
    const urlMatch = responseText.match(/FETCH_URL:\s*(\S+)/)
    if (urlMatch) {
      return { action: 'fetch', url: urlMatch[1] }
    }
  }

  if (responseText.includes('GENERATE_JSON')) {
    const jsonMatch = responseText.match(/GENERATE_JSON[\s\S]*?(\{[\s\S]*\})/)
    if (jsonMatch) {
      const cleanedJson = cleanAndParseJson(jsonMatch[1])
      if (cleanedJson) {
        return { action: 'generate', json: cleanedJson }
      }
    }
  }

  // Essayer de trouver un JSON directement dans la réponse
  const directJsonMatch = responseText.match(/\{[\s\S]*"convention"[\s\S]*"edition"[\s\S]*\}/)
  if (directJsonMatch) {
    const cleanedJson = cleanAndParseJson(directJsonMatch[0])
    if (cleanedJson) {
      return { action: 'generate', json: cleanedJson }
    }
  }

  // Si on ne peut pas parser, demander de générer le JSON
  return { action: 'generate', json: undefined }
}

/**
 * Nettoie et parse un JSON potentiellement mal formaté
 */
function cleanAndParseJson(jsonString: string): string | null {
  // Essayer de parser directement d'abord
  try {
    JSON.parse(jsonString)
    return jsonString
  } catch {
    // Le JSON n'est pas valide, essayer de le nettoyer
  }

  let cleaned = jsonString

  // Supprimer les commentaires JavaScript (// et /* */)
  cleaned = cleaned.replace(/\/\/.*$/gm, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remplacer les guillemets simples par des guillemets doubles pour les clés et valeurs
  // Attention: ne pas remplacer les apostrophes dans le texte
  cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"')
  cleaned = cleaned.replace(/'(\w+)':/g, '"$1":')

  // Gérer les virgules trailing (virgule avant } ou ])
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // Supprimer les caractères de contrôle invalides (sauf newlines et tabs)
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Essayer de parser le JSON nettoyé
  try {
    JSON.parse(cleaned)
    console.log('[AGENT] JSON nettoyé avec succès')
    return cleaned
  } catch (error) {
    console.error('[AGENT] Impossible de parser le JSON même après nettoyage:', error)

    // Dernière tentative: extraire uniquement la partie JSON valide
    try {
      // Trouver le début et la fin du JSON
      const startIndex = cleaned.indexOf('{')
      let braceCount = 0
      let endIndex = -1

      for (let i = startIndex; i < cleaned.length; i++) {
        if (cleaned[i] === '{') braceCount++
        if (cleaned[i] === '}') braceCount--
        if (braceCount === 0) {
          endIndex = i + 1
          break
        }
      }

      if (endIndex > startIndex) {
        const extractedJson = cleaned.substring(startIndex, endIndex)
        JSON.parse(extractedJson)
        console.log('[AGENT] JSON extrait avec succès')
        return extractedJson
      }
    } catch {
      // Abandon
    }
  }

  return null
}

/**
 * Vérifie si une URL est un événement Facebook
 */
function isFacebookEventUrl(url: string): boolean {
  return url.includes('facebook.com/events')
}

/**
 * Formate les données Facebook en contenu textuel pour l'agent
 */
function formatFacebookDataAsContent(fbEvent: FacebookScraperResult, url: string): string {
  let content = `=== PAGE: ${url} ===\n`
  content += `Type: Facebook Event (données structurées via scraper)\n`
  content += `Nom: ${fbEvent.name || 'Non trouvé'}\n`

  if (fbEvent.startTimestamp) {
    const startDate = new Date(fbEvent.startTimestamp * 1000)
    content += `Date début: ${startDate.toISOString()}\n`
  }
  if (fbEvent.endTimestamp) {
    const endDate = new Date(fbEvent.endTimestamp * 1000)
    content += `Date fin: ${endDate.toISOString()}\n`
  }
  if (fbEvent.timezone) {
    content += `Timezone: ${fbEvent.timezone}\n`
  }
  if (fbEvent.location) {
    if (fbEvent.location.name) content += `Lieu: ${fbEvent.location.name}\n`
    if (fbEvent.location.address) content += `Adresse: ${fbEvent.location.address}\n`
    if (fbEvent.location.coordinates) {
      content += `Coordonnées: ${fbEvent.location.coordinates.latitude}, ${fbEvent.location.coordinates.longitude}\n`
    }
    if (fbEvent.location.countryCode) content += `Pays (code): ${fbEvent.location.countryCode}\n`
  }
  if (fbEvent.ticketUrl) {
    content += `URL Billetterie: ${fbEvent.ticketUrl}\n`
  }
  if (fbEvent.photo?.imageUri || fbEvent.photo?.url) {
    content += `Image: ${fbEvent.photo.imageUri || fbEvent.photo.url}\n`
  }
  if (fbEvent.description) {
    // Limiter la description pour ne pas dépasser le contexte
    const truncatedDesc =
      fbEvent.description.length > 2000
        ? fbEvent.description.substring(0, 2000) + '...'
        : fbEvent.description
    content += `\nDescription:\n${truncatedDesc}\n`
  }

  return content
}

/**
 * Fetch une URL et retourne son contenu extrait
 * Utilise le scraper Facebook pour les événements Facebook
 */
async function fetchAndExtractContent(
  url: string,
  taskId: string | undefined,
  visitedUrls: string[],
  logs: AgentLog[],
  maxPageContentSize: number,
  facebookData?: { event: FacebookScraperResult | null; prefilledJson: any | null }
): Promise<{
  success: boolean
  content?: string
  error?: string
  facebookEvent?: FacebookScraperResult
  ogImage?: string // Image OG trouvée (pour la réinjecter après la génération IA)
  // Liens externes trouvés sur la page (pour exploration automatique)
  externalLinks?: {
    officialWebsite: string | null
    facebookEvent: string | null
  }
}> {
  try {
    if (taskId) {
      updateTaskMetadata(taskId, {
        statusText: `Exploration: ${new URL(url).hostname}${new URL(url).pathname.substring(0, 30)}...`,
      })
    }

    // Utiliser le scraper Facebook pour les événements Facebook
    if (isFacebookEventUrl(url)) {
      console.log(`[AGENT] Utilisation du scraper Facebook pour: ${url}`)

      const fbEvent = await scrapeFacebookEvent(url)

      if (fbEvent) {
        const pageContent = formatFacebookDataAsContent(fbEvent, url)
        visitedUrls.push(url)

        // Stocker les données Facebook pré-remplies
        if (facebookData) {
          facebookData.event = fbEvent
          facebookData.prefilledJson = facebookEventToImportJson(fbEvent)
        }

        logs.push({
          iteration: 0,
          action: 'fetched',
          url,
          message: `Facebook Event scrappé avec succès (${pageContent.length} caractères)`,
          timestamp: new Date(),
        })

        console.log(`[AGENT] Facebook Event scrappé: ${fbEvent.name}`)
        return { success: true, content: pageContent, facebookEvent: fbEvent }
      } else {
        // Fallback sur le fetch classique si le scraper échoue
        console.log(`[AGENT] Scraper Facebook échoué, fallback sur fetch classique`)
      }
    }

    // Utiliser le scraper JugglingEdge pour les événements JugglingEdge
    if (isJugglingEdgeEventUrl(url)) {
      console.log(`[AGENT] Utilisation du scraper JugglingEdge pour: ${url}`)

      const jeEvent = await scrapeJugglingEdgeEvent(url)

      if (jeEvent) {
        const pageContent = formatJugglingEdgeDataAsContent(jeEvent, url)
        visitedUrls.push(url)

        // Stocker les données JugglingEdge pré-remplies (réutilise la structure facebookData)
        if (facebookData && !facebookData.prefilledJson) {
          facebookData.prefilledJson = jugglingEdgeEventToImportJson(jeEvent)
        }

        logs.push({
          iteration: 0,
          action: 'fetched',
          url,
          message: `JugglingEdge Event scrappé avec succès (${pageContent.length} caractères)`,
          timestamp: new Date(),
        })

        console.log(`[AGENT] JugglingEdge Event scrappé: ${jeEvent.name}`)
        // Retourner aussi les liens externes pour exploration automatique
        return { success: true, content: pageContent, externalLinks: jeEvent.externalLinks }
      } else {
        // Fallback sur le fetch classique si le scraper échoue
        console.log(`[AGENT] Scraper JugglingEdge échoué, fallback sur fetch classique`)
      }
    }

    // Fetch classique pour les autres URLs ou si les scrapers ont échoué
    const response = await fetchWithTimeout(
      url,
      { headers: BROWSER_HEADERS },
      AI_TIMEOUTS.URL_FETCH
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extraire le contenu structuré pour avoir accès à l'image OG
    const extraction = extractWebContent(html, url)
    const pageContent = formatExtractionForAI(extraction, maxPageContentSize)

    visitedUrls.push(url)

    logs.push({
      iteration: 0,
      action: 'fetched',
      url,
      message: `Page récupérée (${pageContent.length} caractères)`,
      timestamp: new Date(),
    })

    // Retourner aussi l'image OG si trouvée
    return {
      success: true,
      content: pageContent,
      ogImage: extraction.openGraph.image,
    }
  } catch (error: any) {
    console.error(`[AGENT] Erreur fetch ${url}: ${error.message}`)
    logs.push({
      iteration: 0,
      action: 'error',
      url,
      message: `Erreur: ${error.message}`,
      timestamp: new Date(),
    })
    return { success: false, error: error.message }
  }
}

/**
 * Options pour l'exploration par agent
 */
export interface AgentExplorationOptions {
  /** ID de tâche pour le mode polling (ancien système) */
  taskId?: string
  /** Callback de progression pour le mode SSE (nouveau système) */
  onProgress?: ProgressCallback
  /** Image trouvée lors du test (pour éviter de refaire une requête qui retourne une URL différente) */
  previewedImageUrl?: string
}

/**
 * Fonction principale de l'agent d'exploration
 */
export async function runAgentExploration(
  urls: string[],
  options: AgentExplorationOptions = {}
): Promise<AgentGenerateResult> {
  const { taskId, onProgress, previewedImageUrl } = options

  // Helper pour envoyer les événements de progression (polling + SSE)
  const notifyStep = (
    step:
      | 'fetching_urls'
      | 'exploring_page'
      | 'generating_json'
      | 'extracting_features'
      | 'completed'
  ) => {
    if (onProgress) {
      sendStepEvent(onProgress, step)
    }
  }

  const notifyProgress = (urlsVisited: number, maxUrls: number, currentUrl?: string) => {
    if (onProgress) {
      sendProgressEvent(onProgress, urlsVisited, maxUrls, currentUrl)
    }
  }

  const notifyUrlFetched = (url: string) => {
    if (onProgress) {
      sendUrlFetchedEvent(onProgress, url)
    }
  }

  // Récupérer la config IA effective (lit process.env en priorité)
  const configToUse = getEffectiveAIConfig()

  // Calculer les limites de contenu dynamiquement selon le context length du modèle
  const aiProvider = configToUse.aiProvider || 'lmstudio'
  const dynamicMaxContent = await getMaxContentSizeForProvider(
    aiProvider,
    configToUse.lmstudioBaseUrl
  )
  // Pour l'agent, on répartit le budget : ~40% par page, ~80% total (on garde de la marge pour les itérations)
  const maxPageContentSize = Math.max(
    DEFAULT_MAX_PAGE_CONTENT_SIZE,
    Math.floor(dynamicMaxContent * 0.4)
  )
  const maxTotalContentSize = Math.max(
    DEFAULT_MAX_TOTAL_CONTENT_SIZE,
    Math.floor(dynamicMaxContent * 0.8)
  )

  // Debug: afficher la config IA effective
  console.log(`[AGENT] Config IA effective:`, {
    aiProvider: configToUse.aiProvider,
    hasAnthropicKey: !!configToUse.anthropicApiKey,
    lmstudioBaseUrl: configToUse.lmstudioBaseUrl,
    maxPageContentSize,
    maxTotalContentSize,
  })

  const logs: AgentLog[] = []
  const visitedUrls: string[] = []
  const collectedContent: string[] = []
  let totalContentSize = 0
  // Stocker les images OG trouvées pour les injecter plus tard (l'IA peut halluciner les URLs)
  const foundOgImages: string[] = []

  // Stockage des données Facebook (si une URL Facebook est fournie)
  const facebookData: { event: FacebookScraperResult | null; prefilledJson: any | null } = {
    event: null,
    prefilledJson: null,
  }

  logs.push({
    iteration: 0,
    action: 'start',
    message: `Démarrage avec ${urls.length} URL(s) initiale(s)`,
    timestamp: new Date(),
  })

  // ============================================
  // PHASE 1: Explorer TOUTES les URLs fournies
  // ============================================
  console.log(`[AGENT] Phase 1: Exploration des ${urls.length} URLs fournies`)
  notifyStep('fetching_urls')
  if (taskId) {
    updateTaskMetadata(taskId, {
      phase: 'initial',
      statusText: `Phase 1: Exploration des ${urls.length} URLs fournies...`,
    })
  }

  // Collecter les liens externes pour exploration automatique
  const externalLinksToExplore: string[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const progressPercent = Math.round(((i + 1) / urls.length) * 20) // Phase 1 = 0-20%
    if (taskId) {
      updateTaskStatus(taskId, 'processing', progressPercent)
      updateTaskMetadata(taskId, {
        pagesVisited: visitedUrls.length,
        statusText: `Exploration ${i + 1}/${urls.length}: ${new URL(url).hostname}...`,
      })
    }
    notifyProgress(i, urls.length, url)

    const result = await fetchAndExtractContent(
      url,
      taskId,
      visitedUrls,
      logs,
      maxPageContentSize,
      facebookData
    )
    if (result.success && result.content) {
      collectedContent.push(result.content)
      totalContentSize += result.content.length
      notifyUrlFetched(url)

      // Stocker l'image OG si trouvée
      if (result.ogImage) {
        console.log(`[AGENT] Image OG trouvée: ${result.ogImage}`)
        foundOgImages.push(result.ogImage)
      }

      // Collecter les liens externes trouvés (pour exploration automatique)
      if (result.externalLinks) {
        if (result.externalLinks.officialWebsite) {
          externalLinksToExplore.push(result.externalLinks.officialWebsite)
          console.log(
            `[AGENT] Lien externe trouvé (site officiel): ${result.externalLinks.officialWebsite}`
          )
        }
        if (result.externalLinks.facebookEvent) {
          externalLinksToExplore.push(result.externalLinks.facebookEvent)
          console.log(
            `[AGENT] Lien externe trouvé (Facebook): ${result.externalLinks.facebookEvent}`
          )
        }
      }
    }
  }

  // Log si on a des données Facebook
  if (facebookData.event) {
    console.log(`[AGENT] Données Facebook récupérées: ${facebookData.event.name}`)
  }

  console.log(`[AGENT] Phase 1 terminée: ${visitedUrls.length} pages explorées`)

  // ============================================
  // PHASE 1.5: Explorer automatiquement les liens externes
  // ============================================
  if (externalLinksToExplore.length > 0) {
    console.log(
      `[AGENT] Phase 1.5: Exploration automatique de ${externalLinksToExplore.length} liens externes`
    )
    if (taskId) {
      updateTaskMetadata(taskId, {
        phase: 'external_links',
        statusText: `Exploration des liens externes (${externalLinksToExplore.length})...`,
      })
    }

    for (let i = 0; i < externalLinksToExplore.length; i++) {
      const extUrl = externalLinksToExplore[i]

      // Vérifier si déjà visité
      if (visitedUrls.includes(extUrl)) {
        console.log(`[AGENT] Lien externe déjà visité: ${extUrl}`)
        continue
      }

      // Vérifier la limite de contenu
      if (totalContentSize > maxTotalContentSize) {
        console.log(`[AGENT] Limite de contenu atteinte, arrêt exploration externe`)
        break
      }

      const progressPercent = 20 + Math.round(((i + 1) / externalLinksToExplore.length) * 15) // Phase 1.5 = 20-35%
      if (taskId) {
        updateTaskStatus(taskId, 'processing', progressPercent)
        updateTaskMetadata(taskId, {
          pagesVisited: visitedUrls.length,
          statusText: `Exploration lien externe ${i + 1}/${externalLinksToExplore.length}: ${new URL(extUrl).hostname}...`,
        })
      }
      notifyProgress(visitedUrls.length, MAX_AGENT_ITERATIONS, extUrl)

      console.log(`[AGENT] Exploration automatique: ${extUrl}`)
      const result = await fetchAndExtractContent(
        extUrl,
        taskId,
        visitedUrls,
        logs,
        maxPageContentSize,
        facebookData
      )

      if (result.success && result.content) {
        collectedContent.push(result.content)
        totalContentSize += result.content.length
        notifyUrlFetched(extUrl)

        // Stocker l'image OG si trouvée
        if (result.ogImage) {
          console.log(`[AGENT] Image OG trouvée (lien externe): ${result.ogImage}`)
          foundOgImages.push(result.ogImage)
        }
      }
    }

    console.log(
      `[AGENT] Phase 1.5 terminée: ${visitedUrls.length} pages explorées au total (dont liens externes)`
    )
  }

  // ============================================
  // PHASE 2: Demander à l'IA quelles pages supplémentaires explorer
  // ============================================
  console.log('[AGENT] Phase 2: Analyse et suggestions de pages supplémentaires')
  notifyStep('exploring_page')
  if (taskId) {
    updateTaskStatus(taskId, 'processing', 40)
    updateTaskMetadata(taskId, {
      phase: 'analysis',
      pagesVisited: visitedUrls.length,
      statusText: 'Analyse du contenu et recherche de pages supplémentaires...',
    })
  }

  const conversationHistory: Array<{ role: string; content: string }> = []

  // Construire le message COMPACT avec le contenu collecté
  // Limiter le contenu pour éviter le débordement de contexte
  const truncatedContent = collectedContent
    .map((c) => c.substring(0, maxPageContentSize))
    .join('\n---\n')
    .substring(0, maxTotalContentSize)

  // Modifier les instructions selon si des liens externes ont été explorés ou non
  const linksExploredMsg =
    externalLinksToExplore.length > 0
      ? `\nNOTE: Les liens externes (site officiel, Facebook) ont déjà été explorés automatiquement ci-dessus.`
      : ''

  const initialAnalysis = `Contenu de ${visitedUrls.length} page(s):

${truncatedContent}
${linksExploredMsg}

INSTRUCTIONS:
1. Si tu as TOUTES les infos nécessaires (name, email, dates, adresse complète) -> GENERATE_JSON
2. S'il manque des infos importantes et qu'il y a d'autres liens dans le contenu (pas encore explorés) -> FETCH_URL: <url>
3. Génère le JSON dès que tu as suffisamment d'informations`

  conversationHistory.push({ role: 'user', content: initialAnalysis })

  // ============================================
  // PHASE 3: Boucle d'exploration supplémentaire
  // ============================================
  let iteration = 0
  let finalJson: string | undefined
  let consecutiveInvalidRequests = 0 // Compteur de requêtes invalides consécutives
  const MAX_CONSECUTIVE_INVALID = 2 // Après 2 requêtes invalides, forcer la génération
  const maxAdditionalIterations = MAX_AGENT_ITERATIONS - urls.length // Itérations restantes après phase 1

  while (
    iteration < maxAdditionalIterations &&
    !finalJson &&
    consecutiveInvalidRequests < MAX_CONSECUTIVE_INVALID
  ) {
    iteration++
    const progressPercent = 40 + Math.round((iteration / maxAdditionalIterations) * 50) // Phase 2-3 = 40-90%
    if (taskId) {
      updateTaskStatus(taskId, 'processing', progressPercent)
      updateTaskMetadata(taskId, {
        phase: 'exploration',
        pagesVisited: visitedUrls.length,
        currentIteration: iteration,
        maxIterations: maxAdditionalIterations,
        statusText: `Exploration supplémentaire ${iteration}/${maxAdditionalIterations} - ${visitedUrls.length} page(s) au total`,
      })
    }
    notifyProgress(visitedUrls.length, MAX_AGENT_ITERATIONS)

    console.log(`[AGENT] Phase 3 - Iteration ${iteration}/${maxAdditionalIterations}`)

    // Appeler le LLM
    const systemPrompt = getSystemPrompt(configToUse.aiProvider || 'lmstudio')
    const agentResponse = await callAgentLLM(configToUse, systemPrompt, conversationHistory)

    if (agentResponse.action === 'fetch' && agentResponse.url) {
      const urlToFetch = agentResponse.url

      // Vérifier si déjà visité
      if (visitedUrls.includes(urlToFetch)) {
        consecutiveInvalidRequests++
        console.log(
          `[AGENT] URL déjà visitée: ${urlToFetch} (tentative invalide ${consecutiveInvalidRequests}/${MAX_CONSECUTIVE_INVALID})`
        )
        conversationHistory.push({
          role: 'assistant',
          content: `FETCH_URL: ${urlToFetch}`,
        })
        conversationHistory.push({
          role: 'user',
          content: `Cette page a déjà été visitée. Tu DOIS maintenant générer le JSON avec les informations que tu as déjà collectées. Utilise GENERATE_JSON suivi du JSON complet.`,
        })
        continue
      }

      // URL valide, réinitialiser le compteur
      consecutiveInvalidRequests = 0

      // Vérifier la limite de contenu
      if (totalContentSize > maxTotalContentSize) {
        conversationHistory.push({
          role: 'assistant',
          content: `FETCH_URL: ${urlToFetch}`,
        })
        conversationHistory.push({
          role: 'user',
          content: `Limite de contenu atteinte. Tu dois maintenant générer le JSON avec les informations collectées.`,
        })
        continue
      }

      // Fetch la page
      const result = await fetchAndExtractContent(
        urlToFetch,
        taskId,
        visitedUrls,
        logs,
        maxPageContentSize
      )

      if (result.success && result.content) {
        collectedContent.push(result.content)
        totalContentSize += result.content.length
        notifyUrlFetched(urlToFetch)

        // Stocker l'image OG si trouvée
        if (result.ogImage) {
          console.log(`[AGENT] Image OG trouvée (exploration): ${result.ogImage}`)
          foundOgImages.push(result.ogImage)
        }

        if (taskId) {
          updateTaskMetadata(taskId, {
            pagesVisited: visitedUrls.length,
            lastVisitedUrl: urlToFetch,
          })
        }

        conversationHistory.push({
          role: 'assistant',
          content: `FETCH_URL: ${urlToFetch}`,
        })
        conversationHistory.push({
          role: 'user',
          content: `Voici le contenu de la page:\n\n${result.content}\n\nAs-tu maintenant assez d'informations pour générer le JSON ? Si oui, utilise GENERATE_JSON. Sinon, tu peux explorer une autre page avec FETCH_URL.`,
        })
      } else {
        conversationHistory.push({
          role: 'assistant',
          content: `FETCH_URL: ${urlToFetch}`,
        })
        conversationHistory.push({
          role: 'user',
          content: `Erreur lors de l'accès à cette page: ${result.error}. Choisis une autre URL ou génère le JSON.`,
        })
      }
    } else if (agentResponse.action === 'generate') {
      if (agentResponse.json) {
        finalJson = agentResponse.json
        logs.push({
          iteration,
          action: 'generate',
          message: 'JSON généré avec succès',
          timestamp: new Date(),
        })
      } else {
        // Demander explicitement de générer le JSON
        conversationHistory.push({
          role: 'assistant',
          content: 'GENERATE_JSON',
        })
        conversationHistory.push({
          role: 'user',
          content: `Tu dois générer le JSON final maintenant. Utilise toutes les informations collectées pour créer un JSON valide avec la structure attendue (convention et edition).`,
        })
      }
    }
  }

  // Si on n'a pas de JSON après toutes les itérations, forcer la génération
  if (!finalJson) {
    console.log('[AGENT] Forçage de la génération du JSON final')
    notifyStep('generating_json')
    if (taskId) {
      updateTaskMetadata(taskId, {
        phase: 'generation',
        statusText: 'Génération du JSON final...',
      })
    }

    // Si on a des données Facebook, utiliser le prompt de complétion pré-rempli (comme ED)
    // Sinon, utiliser le prompt de génération forcée standard
    let forcePrompt: string
    let systemPromptToUse: string

    if (facebookData.prefilledJson) {
      console.log('[AGENT] Utilisation du prompt de complétion avec données Facebook pré-remplies')
      const prefilledJsonStr = JSON.stringify(facebookData.prefilledJson, null, 2)
      const contentSummary = collectedContent.slice(0, 2).join('\n\n---\n\n')

      forcePrompt = `Voici un JSON pré-rempli avec les données Facebook:

${prefilledJsonStr}

Et voici les informations supplémentaires trouvées sur les autres pages:

${contentSummary}

Complète les champs vides avec les informations des sources. Réponds UNIQUEMENT avec le JSON complet.`

      systemPromptToUse = PROMPT_COMPLETE_PREFILLED_JSON
    } else {
      const contentSummary = collectedContent.slice(0, 3).join('\n\n---\n\n')
      forcePrompt = generateForceGenerationPrompt(visitedUrls, contentSummary)
      systemPromptToUse = getSystemPrompt(configToUse.aiProvider || 'lmstudio')
    }

    conversationHistory.push({
      role: 'user',
      content: forcePrompt,
    })

    const finalResponse = await callAgentLLM(configToUse, systemPromptToUse, conversationHistory)
    console.log('[AGENT] Réponse au forçage:', finalResponse)

    if (finalResponse.json) {
      finalJson = finalResponse.json
    } else {
      // Dernière tentative: essayer d'extraire un JSON de la conversation
      console.log('[AGENT] Dernière tentative: extraction directe du JSON')

      // Chercher dans les dernières réponses de l'assistant
      for (let i = conversationHistory.length - 1; i >= 0 && !finalJson; i--) {
        const msg = conversationHistory[i]
        if (msg.role === 'assistant') {
          const jsonMatch = msg.content.match(/\{[\s\S]*"convention"[\s\S]*"edition"[\s\S]*\}/)
          if (jsonMatch) {
            const cleaned = cleanAndParseJson(jsonMatch[0])
            if (cleaned) {
              finalJson = cleaned
              console.log("[AGENT] JSON extrait de l'historique de conversation")
            }
          }
        }
      }

      if (!finalJson) {
        // Fallback: utiliser la méthode simple de génération
        console.log('[AGENT] Fallback vers la méthode simple de génération')
        if (taskId) {
          updateTaskMetadata(taskId, {
            phase: 'fallback',
            statusText: 'Utilisation de la méthode de génération simple...',
          })
        }

        try {
          const simpleResult = await generateImportJson(visitedUrls, {})
          if (simpleResult.success && simpleResult.json) {
            finalJson = simpleResult.json
            console.log('[AGENT] JSON généré via la méthode simple (fallback)')
          }
        } catch (fallbackError) {
          console.error('[AGENT] Échec du fallback:', fallbackError)
        }

        if (!finalJson) {
          throw new Error(
            "L'agent n'a pas pu générer de JSON valide après plusieurs tentatives (fallback inclus)"
          )
        }
      }
    }
  }

  // ============================================
  // PHASE 4: Fusion avec les données Facebook et extraction des caractéristiques
  // ============================================
  notifyStep('extracting_features')
  if (taskId) {
    updateTaskStatus(taskId, 'processing', 90)
    updateTaskMetadata(taskId, {
      phase: 'enrichment',
      statusText: 'Enrichissement du JSON...',
    })
  }

  let enrichedJson = finalJson

  try {
    let parsedJson = JSON.parse(finalJson)

    // Si on a des données Facebook/JugglingEdge pré-remplies, les fusionner avec le JSON généré
    // Les données pré-remplies sont PRIORITAIRES pour les champs qu'elles contiennent
    if (facebookData.prefilledJson) {
      console.log('[AGENT] Fusion avec les données pré-remplies (Facebook/JugglingEdge)')
      const fbJson = facebookData.prefilledJson

      // Log des dates pré-remplies vs générées
      console.log('[AGENT] Dates pré-remplies:', {
        startDate: fbJson.edition?.startDate,
        endDate: fbJson.edition?.endDate,
      })
      console.log('[AGENT] Dates générées par IA:', {
        startDate: parsedJson.edition?.startDate,
        endDate: parsedJson.edition?.endDate,
      })

      // Fusionner edition (données pré-remplies prioritaires pour les champs remplis)
      // EXCEPTION: pour les dates, si l'IA a trouvé des heures et pas les données pré-remplies,
      // on préserve les heures de l'IA
      if (fbJson.edition) {
        for (const [key, value] of Object.entries(fbJson.edition)) {
          // Ne remplacer que si la valeur pré-remplie n'est pas vide
          if (value !== '' && value !== null && value !== undefined) {
            parsedJson.edition = parsedJson.edition || {}

            // Traitement spécial pour les dates: préserver les heures de l'IA si disponibles
            if ((key === 'startDate' || key === 'endDate') && typeof value === 'string') {
              const prefilledDate = value as string
              const aiDate = parsedJson.edition[key] as string | undefined

              // Si la date pré-remplie n'a pas d'heure (pas de T) mais que l'IA en a trouvé une
              if (!prefilledDate.includes('T') && aiDate && aiDate.includes('T')) {
                // Extraire l'heure de la date de l'IA et l'appliquer à la date pré-remplie
                const aiTime = aiDate.split('T')[1]
                if (aiTime) {
                  parsedJson.edition[key] = `${prefilledDate}T${aiTime}`
                  console.log(
                    `[AGENT] Date ${key}: combinée date pré-remplie (${prefilledDate}) + heure IA (${aiTime})`
                  )
                  continue // Ne pas écraser avec la valeur pré-remplie
                }
              }
            }

            parsedJson.edition[key] = value
          }
        }
      }

      // Log des dates après fusion
      console.log('[AGENT] Dates après fusion:', {
        startDate: parsedJson.edition?.startDate,
        endDate: parsedJson.edition?.endDate,
      })

      // Pour convention, garder les données de l'agent (plus complètes généralement)
      // sauf si l'agent n'a pas trouvé ces infos
      if (fbJson.convention) {
        parsedJson.convention = parsedJson.convention || {}
        if (!parsedJson.convention.name && fbJson.convention.name) {
          parsedJson.convention.name = fbJson.convention.name
        }
      }
    } else {
      console.log('[AGENT] Pas de données pré-remplies, dates générées uniquement par IA:', {
        startDate: parsedJson.edition?.startDate,
        endDate: parsedJson.edition?.endDate,
      })
    }

    // Enrichir les dates avec les heures trouvées dans le contenu (si pas déjà présentes)
    extractAndApplyTimeFromContent(parsedJson, collectedContent)
    console.log('[AGENT] Dates finales après enrichissement:', {
      startDate: parsedJson.edition?.startDate,
      endDate: parsedJson.edition?.endDate,
    })

    // Post-traitement: Injecter l'image trouvée lors du test ou extraite programmatiquement
    // Priorité: 1) previewedImageUrl (du test) 2) foundOgImages (de l'extraction)
    // L'IA peut halluciner des URLs différentes, donc on utilise l'image du test en priorité
    const imageToInject = previewedImageUrl || (foundOgImages.length > 0 ? foundOgImages[0] : null)
    if (imageToInject) {
      const currentImageUrl = parsedJson.edition?.imageUrl || ''

      // Si pas d'image ou image différente de celle trouvée, utiliser celle du test/extraction
      if (!currentImageUrl || currentImageUrl !== imageToInject) {
        console.log(
          `[AGENT] Injection de l'image (IA: "${currentImageUrl}" -> ${previewedImageUrl ? 'Test' : 'Extraction'}: "${imageToInject}")`
        )
        if (!parsedJson.edition) parsedJson.edition = {}
        parsedJson.edition.imageUrl = imageToInject
      }
    }

    // Extraire les caractéristiques (services) via IA
    const description = parsedJson.edition?.description || ''
    if (description && description.length >= 50) {
      console.log('[AGENT] Extraction des caractéristiques via IA...')
      if (taskId) {
        updateTaskMetadata(taskId, {
          statusText: 'Détection des services (camping, restauration, spectacles...)',
        })
      }

      const features = await extractEditionFeatures(
        description,
        configToUse.aiProvider || 'lmstudio',
        {
          lmstudioBaseUrl: configToUse.lmstudioBaseUrl,
          lmstudioTextModel: configToUse.lmstudioTextModel,
          lmstudioModel: configToUse.lmstudioModel,
          anthropicApiKey: configToUse.anthropicApiKey,
          ollamaBaseUrl: configToUse.ollamaBaseUrl,
          ollamaModel: configToUse.ollamaModel,
        }
      )

      if (Object.keys(features).length > 0) {
        console.log('[AGENT] Caractéristiques détectées:', features)
        parsedJson = mergeFeaturesIntoJson(parsedJson, features)
      }
    }

    enrichedJson = JSON.stringify(parsedJson, null, 2)
  } catch (error: any) {
    console.error(`[AGENT] Erreur enrichissement: ${error.message}`)
    // On continue avec le JSON non enrichi
  }

  notifyStep('completed')
  if (taskId) {
    updateTaskStatus(taskId, 'processing', 100)
    updateTaskMetadata(taskId, {
      phase: 'completed',
      statusText: 'Génération terminée',
    })
  }

  return {
    success: true,
    json: enrichedJson,
    provider: configToUse.aiProvider || 'lmstudio',
    urlsProcessed: visitedUrls,
    iterations: urls.length + iteration,
  }
}

/**
 * POST /api/admin/generate-import-json-agent
 * Crée une tâche d'exploration par agent et retourne immédiatement un taskId
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const { urls } = requestSchema.parse(body)

    // Créer une tâche asynchrone
    const task = createTask<AgentGenerateResult>({ urls, mode: 'agent' })

    console.log(`[AGENT] Tâche créée: ${task.id} pour ${urls.length} URL(s)`)

    // Lancer l'exploration en arrière-plan
    runTaskInBackground(task.id, () => runAgentExploration(urls, { taskId: task.id }))

    // Retourner immédiatement le taskId
    return {
      taskId: task.id,
      status: 'processing',
      message: 'Exploration intelligente en cours...',
    }
  },
  { operationName: 'GenerateImportJsonAgent' }
)
