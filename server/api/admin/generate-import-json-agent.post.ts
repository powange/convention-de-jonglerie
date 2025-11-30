import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
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
  generateAgentSystemPrompt,
  generateCompactAgentSystemPrompt,
  generateForceGenerationPrompt,
} from '@@/server/utils/import-json-schema'
import { extractAndFormatWebContent } from '@@/server/utils/web-content-extractor'
import { z } from 'zod'

import { generateImportJson } from './generate-import-json.post'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

// Timeout pour les requêtes HTTP (en ms)
const URL_FETCH_TIMEOUT = 15000 // 15 secondes par URL
const LLM_TIMEOUT = 180000 // 3 minutes pour le LLM
const MAX_AGENT_ITERATIONS = 4 // Maximum de pages à explorer (réduit pour éviter context overflow)
const MAX_TOTAL_CONTENT_SIZE = 10000 // Limite de contenu total en caractères (réduit pour modèles locaux 4k ctx)
const MAX_PAGE_CONTENT_SIZE = 2500 // Limite par page en caractères

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
      LLM_TIMEOUT
    )

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.statusText}`)
    }

    const data = await response.json()
    responseText = data.choices?.[0]?.message?.content || ''
  } else if (aiProvider === 'anthropic' && config.anthropicApiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: config.anthropicApiKey,
      timeout: LLM_TIMEOUT,
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
  } else {
    throw new Error(`Provider IA non supporté: ${aiProvider}`)
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
  taskId: string,
  visitedUrls: string[],
  logs: AgentLog[],
  facebookData?: { event: FacebookScraperResult | null; prefilledJson: any | null }
): Promise<{
  success: boolean
  content?: string
  error?: string
  facebookEvent?: FacebookScraperResult
}> {
  try {
    updateTaskMetadata(taskId, {
      statusMessage: `Exploration: ${new URL(url).hostname}${new URL(url).pathname.substring(0, 30)}...`,
    })

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

    // Fetch classique pour les autres URLs ou si le scraper Facebook a échoué
    const response = await fetchWithTimeout(url, { headers: BROWSER_HEADERS }, URL_FETCH_TIMEOUT)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const pageContent = extractAndFormatWebContent(html, url, MAX_PAGE_CONTENT_SIZE)

    visitedUrls.push(url)

    logs.push({
      iteration: 0,
      action: 'fetched',
      url,
      message: `Page récupérée (${pageContent.length} caractères)`,
      timestamp: new Date(),
    })

    return { success: true, content: pageContent }
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
 * Fonction principale de l'agent d'exploration
 */
export async function runAgentExploration(
  urls: string[],
  taskId: string
): Promise<AgentGenerateResult> {
  const config = useRuntimeConfig()
  const logs: AgentLog[] = []
  const visitedUrls: string[] = []
  const collectedContent: string[] = []
  let totalContentSize = 0

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
  updateTaskMetadata(taskId, {
    phase: 'initial',
    statusMessage: `Phase 1: Exploration des ${urls.length} URLs fournies...`,
  })

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const progressPercent = Math.round(((i + 1) / urls.length) * 30) // Phase 1 = 0-30%
    updateTaskStatus(taskId, 'processing', progressPercent)
    updateTaskMetadata(taskId, {
      pagesVisited: visitedUrls.length,
      statusMessage: `Exploration ${i + 1}/${urls.length}: ${new URL(url).hostname}...`,
    })

    const result = await fetchAndExtractContent(url, taskId, visitedUrls, logs, facebookData)
    if (result.success && result.content) {
      collectedContent.push(result.content)
      totalContentSize += result.content.length
    }
  }

  // Log si on a des données Facebook
  if (facebookData.event) {
    console.log(`[AGENT] Données Facebook récupérées: ${facebookData.event.name}`)
  }

  console.log(`[AGENT] Phase 1 terminée: ${visitedUrls.length} pages explorées`)

  // ============================================
  // PHASE 2: Demander à l'IA quelles pages supplémentaires explorer
  // ============================================
  console.log('[AGENT] Phase 2: Analyse et suggestions de pages supplémentaires')
  updateTaskStatus(taskId, 'processing', 35)
  updateTaskMetadata(taskId, {
    phase: 'analysis',
    pagesVisited: visitedUrls.length,
    statusMessage: 'Analyse du contenu et recherche de pages supplémentaires...',
  })

  const conversationHistory: Array<{ role: string; content: string }> = []

  // Construire le message COMPACT avec le contenu collecté
  // Limiter le contenu pour éviter le débordement de contexte
  const truncatedContent = collectedContent
    .map((c) => c.substring(0, MAX_PAGE_CONTENT_SIZE))
    .join('\n---\n')
    .substring(0, MAX_TOTAL_CONTENT_SIZE)

  const initialAnalysis = `Contenu de ${visitedUrls.length} page(s):

${truncatedContent}

Si tu as name, email, dates, adresse, ville, pays, code postal -> GENERATE_JSON avec le JSON complet.
Sinon, si des liens utiles sont listés -> FETCH_URL: <url>`

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
    const progressPercent = 35 + Math.round((iteration / maxAdditionalIterations) * 55) // Phase 2-3 = 35-90%
    updateTaskStatus(taskId, 'processing', progressPercent)
    updateTaskMetadata(taskId, {
      phase: 'exploration',
      pagesVisited: visitedUrls.length,
      currentIteration: iteration,
      maxIterations: maxAdditionalIterations,
      statusMessage: `Exploration supplémentaire ${iteration}/${maxAdditionalIterations} - ${visitedUrls.length} page(s) au total`,
    })

    console.log(`[AGENT] Phase 3 - Iteration ${iteration}/${maxAdditionalIterations}`)

    // Appeler le LLM
    const systemPrompt = getSystemPrompt(config.aiProvider || 'lmstudio')
    const agentResponse = await callAgentLLM(config, systemPrompt, conversationHistory)

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
      if (totalContentSize > MAX_TOTAL_CONTENT_SIZE) {
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
      const result = await fetchAndExtractContent(urlToFetch, taskId, visitedUrls, logs)

      if (result.success && result.content) {
        collectedContent.push(result.content)
        totalContentSize += result.content.length

        updateTaskMetadata(taskId, {
          pagesVisited: visitedUrls.length,
          lastVisitedUrl: urlToFetch,
        })

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
    updateTaskMetadata(taskId, {
      phase: 'generation',
      statusMessage: 'Génération du JSON final...',
    })

    // Utiliser un prompt de génération forcée depuis le module import-json-schema
    const contentSummary = collectedContent.slice(0, 3).join('\n\n---\n\n')
    const forcePrompt = generateForceGenerationPrompt(visitedUrls, contentSummary)

    conversationHistory.push({
      role: 'user',
      content: forcePrompt,
    })

    const systemPrompt = getSystemPrompt(config.aiProvider || 'lmstudio')
    const finalResponse = await callAgentLLM(config, systemPrompt, conversationHistory)
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
        updateTaskMetadata(taskId, {
          phase: 'fallback',
          statusMessage: 'Utilisation de la méthode de génération simple...',
        })

        try {
          const simpleResult = await generateImportJson(visitedUrls)
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
  updateTaskStatus(taskId, 'processing', 90)
  updateTaskMetadata(taskId, {
    phase: 'enrichment',
    statusMessage: 'Enrichissement du JSON...',
  })

  let enrichedJson = finalJson

  try {
    let parsedJson = JSON.parse(finalJson)

    // Si on a des données Facebook pré-remplies, les fusionner avec le JSON généré
    // Les données Facebook sont prioritaires pour les champs qu'elles contiennent
    if (facebookData.prefilledJson) {
      console.log('[AGENT] Fusion avec les données Facebook pré-remplies')
      const fbJson = facebookData.prefilledJson

      // Fusionner edition (Facebook prioritaire pour les champs remplis)
      if (fbJson.edition) {
        for (const [key, value] of Object.entries(fbJson.edition)) {
          // Ne remplacer que si la valeur Facebook n'est pas vide
          if (value !== '' && value !== null && value !== undefined) {
            parsedJson.edition = parsedJson.edition || {}
            parsedJson.edition[key] = value
          }
        }
      }

      // Pour convention, garder les données de l'agent (plus complètes généralement)
      // sauf si l'agent n'a pas trouvé ces infos
      if (fbJson.convention) {
        parsedJson.convention = parsedJson.convention || {}
        if (!parsedJson.convention.name && fbJson.convention.name) {
          parsedJson.convention.name = fbJson.convention.name
        }
      }
    }

    // Extraire les caractéristiques (services) via IA
    const description = parsedJson.edition?.description || ''
    if (description && description.length >= 50) {
      console.log('[AGENT] Extraction des caractéristiques via IA...')
      updateTaskMetadata(taskId, {
        statusMessage: 'Détection des services (camping, restauration, spectacles...)',
      })

      const features = await extractEditionFeatures(description, config.aiProvider || 'lmstudio', {
        lmstudioBaseUrl: config.lmstudioBaseUrl,
        lmstudioTextModel: config.lmstudioTextModel,
        lmstudioModel: config.lmstudioModel,
        anthropicApiKey: config.anthropicApiKey,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
      })

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

  updateTaskStatus(taskId, 'processing', 100)
  updateTaskMetadata(taskId, {
    phase: 'completed',
    statusMessage: 'Génération terminée',
  })

  return {
    success: true,
    json: enrichedJson,
    provider: config.aiProvider || 'lmstudio',
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
    runTaskInBackground(task.id, () => runAgentExploration(urls, task.id))

    // Retourner immédiatement le taskId
    return {
      taskId: task.id,
      status: 'processing',
      message: 'Exploration intelligente en cours...',
    }
  },
  { operationName: 'GenerateImportJsonAgent' }
)
