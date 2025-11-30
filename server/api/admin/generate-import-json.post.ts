import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { createTask, runTaskInBackground, updateTaskMetadata } from '@@/server/utils/async-tasks'
import {
  extractEditionFeatures,
  mergeFeaturesIntoJson,
} from '@@/server/utils/edition-features-extractor'
import {
  facebookEventToImportJson,
  scrapeFacebookEvent,
  type FacebookImportJson,
} from '@@/server/utils/facebook-event-scraper'
import {
  BROWSER_HEADERS,
  fetchWithBrowserless,
  fetchWithTimeout,
  isBrowserlessAvailable,
} from '@@/server/utils/fetch-helpers'
import { extractAndFormatWebContent } from '@@/server/utils/web-content-extractor'
import { z } from 'zod'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

// Timeout pour les requêtes HTTP (en ms)
const URL_FETCH_TIMEOUT = 15000 // 15 secondes par URL
const LLM_TIMEOUT = 180000 // 3 minutes pour le LLM (modèles locaux peuvent être lents)

// Type pour le résultat de la génération
export interface GenerateImportResult {
  success: boolean
  json: string
  provider: string
  urlsProcessed: number
}

// Format JSON pour le prompt IA (avec indications OBLIGATOIRE/optionnel)
const JSON_FORMAT_FOR_AI = `{
  "convention": {
    "name": "OBLIGATOIRE - Nom de l'événement",
    "email": "OBLIGATOIRE - Email de contact",
    "description": "optionnel"
  },
  "edition": {
    "name": "optionnel",
    "description": "optionnel",
    "startDate": "OBLIGATOIRE - Format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS",
    "endDate": "OBLIGATOIRE - Format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS",
    "timezone": "OBLIGATOIRE - Format IANA (ex: Europe/Paris, Australia/Melbourne)",
    "addressLine1": "OBLIGATOIRE - Adresse",
    "addressLine2": "optionnel",
    "city": "OBLIGATOIRE",
    "region": "optionnel",
    "country": "OBLIGATOIRE",
    "postalCode": "OBLIGATOIRE",
    "latitude": "optionnel - number",
    "longitude": "optionnel - number",
    "ticketingUrl": "optionnel",
    "facebookUrl": "optionnel",
    "instagramUrl": "optionnel",
    "officialWebsiteUrl": "optionnel",
    "imageUrl": "optionnel"
  }
}`

// Prompt pour compléter un JSON pré-rempli (Facebook + autres URLs)
const PROMPT_COMPLETE_JSON = `Tu dois compléter un JSON pré-rempli avec les informations des sources fournies.

CHAMPS PRIORITAIRES À REMPLIR:
- convention.name : Le nom de la CONVENTION (pas l'édition). Cherche dans les sources le nom générique de l'événement récurrent.
- convention.email : L'email de contact UNIQUEMENT s'il est explicitement mentionné dans les sources. NE PAS INVENTER.
- instagramUrl : Le lien vers le compte Instagram s'il est mentionné (format: https://instagram.com/...)

FORMAT ATTENDU:
${JSON_FORMAT_FOR_AI}

RÈGLES:
1. NE MODIFIE PAS les champs déjà remplis (non vides)
2. Complète les champs vides ("" ou null) avec les données des sources
3. convention.name = nom générique de la convention (ex: "Spinfest" pas "Spinfest 2025")
4. convention.email = UNIQUEMENT si trouvé explicitement dans les sources, sinon laisser vide ""
5. instagramUrl = lien Instagram si trouvé dans les sources
6. Réponds UNIQUEMENT avec le JSON complet, sans commentaires`

// Prompt système complet pour Anthropic (modèles avec grand contexte)
const SYSTEM_PROMPT_FULL = `Tu extrais les informations d'une convention de jonglerie depuis des pages web.
Génère un JSON au format spécifié. Le nom doit être celui de L'ÉVÉNEMENT, pas du site source.
Email: UNIQUEMENT si explicitement trouvé dans les sources, sinon laisser vide. NE PAS INVENTER.
Instagram: Extraire le lien Instagram si présent dans les sources.
Déduis le timezone IANA du pays (France=Europe/Paris, Allemagne=Europe/Berlin, etc.).
Réponds UNIQUEMENT avec le JSON, sans texte autour.

FORMAT:
${JSON_FORMAT_FOR_AI}`

// Prompt système compact pour LM Studio (contexte limité ~4096 tokens)
const SYSTEM_PROMPT_COMPACT = `Extrais les infos de convention de jonglerie en JSON.
Format: {"convention":{"name":"NOM_EVENT","email":"","description":""},"edition":{"name":"","description":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","timezone":"Europe/Paris","addressLine1":"","addressLine2":"","city":"","region":"","country":"","postalCode":"","latitude":null,"longitude":null,"ticketingUrl":"","facebookUrl":"","instagramUrl":"","officialWebsiteUrl":"","imageUrl":""}}
Règles: nom=événement pas site, email=seulement si trouvé (pas inventer), instagram=si trouvé, timezone=IANA du pays. JSON seul.`

/**
 * Étapes de la génération (pour le suivi côté frontend)
 */
export const GENERATION_STEPS = {
  scraping_facebook: 'Récupération des données Facebook...',
  fetching_urls: 'Récupération du contenu des URLs...',
  generating_json: 'Génération du JSON via IA...',
  extracting_features: 'Détection des services (camping, restauration, spectacles...)',
  completed: 'Terminé',
} as const

export type GenerationStep = keyof typeof GENERATION_STEPS

/**
 * Met à jour l'étape de la tâche
 */
function updateStep(taskId: string | undefined, step: GenerationStep): void {
  if (taskId) {
    updateTaskMetadata(taskId, {
      step,
      stepLabel: GENERATION_STEPS[step],
    })
  }
}

/**
 * Fonction de génération du JSON (exécutée en arrière-plan)
 *
 * Nouvelle approche Facebook-first:
 * 1. Si URL Facebook présente: extraire les données directement en JSON pré-rempli
 * 2. Si autres URLs: récupérer leur contenu
 * 3. Appeler l'IA pour compléter les champs manquants (si JSON pré-rempli) ou générer tout (sinon)
 * 4. Extraire les caractéristiques (services) de l'édition via IA
 */
export async function generateImportJson(
  urls: string[],
  taskId?: string
): Promise<GenerateImportResult> {
  // Vérifier si browserless est disponible
  const config = useRuntimeConfig()

  // Lire les variables d'env en priorité (comme config.get.ts)
  // car useRuntimeConfig() ne récupère pas toujours les NUXT_* au runtime
  const effectiveConfig = {
    ...config,
    aiProvider: process.env.AI_PROVIDER || process.env.NUXT_AI_PROVIDER || config.aiProvider,
    lmstudioBaseUrl:
      process.env.LMSTUDIO_BASE_URL ||
      process.env.NUXT_LMSTUDIO_BASE_URL ||
      config.lmstudioBaseUrl,
    lmstudioModel:
      process.env.LMSTUDIO_MODEL || process.env.NUXT_LMSTUDIO_MODEL || config.lmstudioModel,
    lmstudioTextModel:
      process.env.LMSTUDIO_TEXT_MODEL ||
      process.env.NUXT_LMSTUDIO_TEXT_MODEL ||
      config.lmstudioTextModel,
    browserlessUrl:
      process.env.BROWSERLESS_URL || process.env.NUXT_BROWSERLESS_URL || config.browserlessUrl,
  }

  const browserlessUrl = effectiveConfig.browserlessUrl
  const useBrowserless = browserlessUrl && (await isBrowserlessAvailable(browserlessUrl))

  if (useBrowserless) {
    console.log(`[GENERATE-IMPORT] Utilisation de browserless: ${browserlessUrl}`)
  } else {
    console.log('[GENERATE-IMPORT] Browserless non disponible, utilisation de fetch simple')
  }

  // Séparer les URLs Facebook des autres
  const facebookUrls = urls.filter((url) => url.includes('facebook.com/events'))
  const otherUrls = urls.filter((url) => !url.includes('facebook.com/events'))

  console.log(
    `[GENERATE-IMPORT] URLs Facebook Events: ${facebookUrls.length}, Autres URLs: ${otherUrls.length}`
  )

  // Structure pour le JSON pré-rempli (depuis Facebook)
  let prefilledJson: FacebookImportJson | null = null

  // Étape 1: Traiter les URLs Facebook avec facebook-event-scraper
  if (facebookUrls.length > 0) {
    updateStep(taskId, 'scraping_facebook')
  }

  for (const url of facebookUrls) {
    try {
      console.log(`[GENERATE-IMPORT] Scraping Facebook Event: ${url}`)
      const fbEvent = await scrapeFacebookEvent(url)

      if (fbEvent) {
        console.log('[GENERATE-IMPORT] === Données Facebook Event Scraper ===')
        console.log(JSON.stringify(fbEvent, null, 2))
        console.log('[GENERATE-IMPORT] === Fin données Facebook ===')

        // Convertir en JSON d'import pré-rempli
        prefilledJson = facebookEventToImportJson(fbEvent)
        console.log('[GENERATE-IMPORT] JSON pré-rempli depuis Facebook:')
        console.log(JSON.stringify(prefilledJson, null, 2))

        // On ne traite qu'une seule URL Facebook (la première avec des données)
        break
      }
    } catch (error: any) {
      console.error(`[GENERATE-IMPORT] Erreur scraping Facebook ${url}: ${error.message}`)
    }
  }

  // Étape 2: Récupérer le contenu des autres URLs
  const otherContents: string[] = []

  // Budget de contenu adapté selon si on a déjà un JSON pré-rempli
  const totalContentBudget = prefilledJson ? 1500 : 2500 // Moins de contenu si on complète juste
  const maxContentPerUrl =
    otherUrls.length > 0 ? Math.floor(totalContentBudget / otherUrls.length) : totalContentBudget

  if (otherUrls.length > 0) {
    updateStep(taskId, 'fetching_urls')
  }

  for (const url of otherUrls) {
    try {
      let html: string

      if (useBrowserless) {
        html = await fetchWithBrowserless(browserlessUrl, url, {
          timeout: URL_FETCH_TIMEOUT,
          waitForNetworkIdle: true,
        })
        console.log(
          `[GENERATE-IMPORT] HTML récupéré via browserless pour ${url}: ${html.length} caractères`
        )
      } else {
        const response = await fetchWithTimeout(
          url,
          { headers: BROWSER_HEADERS },
          URL_FETCH_TIMEOUT
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        html = await response.text()
      }

      // Extraire le contenu du HTML avec le nouvel utilitaire
      const textContent = extractAndFormatWebContent(html, url, maxContentPerUrl)
      otherContents.push(textContent)
    } catch (error: any) {
      const errorMsg =
        error.name === 'AbortError' ? `Timeout après ${URL_FETCH_TIMEOUT / 1000}s` : error.message
      console.error(`[GENERATE-IMPORT] Erreur fetch ${url}: ${errorMsg}`)
      otherContents.push(
        `=== Erreur pour ${url} ===\nImpossible de récupérer le contenu: ${errorMsg}`
      )
    }
  }

  // Récupérer la configuration IA effective
  const aiProvider = effectiveConfig.aiProvider || 'lmstudio'
  console.log(`[GENERATE-IMPORT] Provider IA: ${aiProvider}`)

  let generatedJson: string

  // Étape 3: Générer ou compléter le JSON via IA
  updateStep(taskId, 'generating_json')

  if (prefilledJson && otherContents.length === 0) {
    // Cas 1: Uniquement Facebook, pas d'IA - retourne le JSON tel quel
    console.log("[GENERATE-IMPORT] Facebook seul, pas d'IA")
    generatedJson = JSON.stringify(prefilledJson, null, 2)
  } else if (prefilledJson && otherContents.length > 0) {
    // Cas 2: Facebook + autres URLs - demander à l'IA de compléter convention.name, convention.email et autres champs vides
    console.log('[GENERATE-IMPORT] Facebook + autres URLs, IA complète les champs manquants')
    const combinedOtherContent = otherContents.join('\n\n')
    generatedJson = await callAIToCompleteJson(
      effectiveConfig as typeof config,
      aiProvider,
      prefilledJson,
      combinedOtherContent
    )
  } else {
    // Cas 3: Pas de Facebook - extraction complète par l'IA
    console.log("[GENERATE-IMPORT] Pas de Facebook, extraction complète par l'IA")
    const combinedContent = otherContents.join('\n\n')

    if (aiProvider === 'lmstudio') {
      generatedJson = await callLMStudio(
        effectiveConfig.lmstudioBaseUrl || 'http://localhost:1234',
        effectiveConfig.lmstudioTextModel || effectiveConfig.lmstudioModel || 'auto',
        combinedContent
      )
    } else if (aiProvider === 'anthropic' && effectiveConfig.anthropicApiKey) {
      generatedJson = await callAnthropic(effectiveConfig.anthropicApiKey, combinedContent)
    } else if (aiProvider === 'ollama') {
      generatedJson = await callOllama(
        effectiveConfig.ollamaBaseUrl || 'http://localhost:11434',
        effectiveConfig.ollamaModel || 'llama3',
        combinedContent
      )
    } else {
      throw new Error(`Provider IA non configuré ou non supporté: ${aiProvider}`)
    }
  }

  // Étape 4: Extraire les caractéristiques (services) de l'édition via IA
  // On utilise la description de l'édition pour détecter les services offerts
  updateStep(taskId, 'extracting_features')

  let finalJson = generatedJson
  try {
    const parsedJson = JSON.parse(generatedJson)
    const description = parsedJson.edition?.description || ''

    if (description && description.length >= 50) {
      console.log('[GENERATE-IMPORT] Extraction des caractéristiques via IA...')
      const features = await extractEditionFeatures(description, aiProvider, {
        lmstudioBaseUrl: effectiveConfig.lmstudioBaseUrl,
        lmstudioTextModel: effectiveConfig.lmstudioTextModel,
        lmstudioModel: effectiveConfig.lmstudioModel,
        anthropicApiKey: effectiveConfig.anthropicApiKey,
        ollamaBaseUrl: effectiveConfig.ollamaBaseUrl,
        ollamaModel: effectiveConfig.ollamaModel,
      })

      if (Object.keys(features).length > 0) {
        console.log('[GENERATE-IMPORT] Caractéristiques détectées:', features)
        const enrichedJson = mergeFeaturesIntoJson(parsedJson, features)
        finalJson = JSON.stringify(enrichedJson, null, 2)
      } else {
        console.log('[GENERATE-IMPORT] Aucune caractéristique détectée')
      }
    } else {
      console.log('[GENERATE-IMPORT] Description trop courte pour extraire les caractéristiques')
    }
  } catch (error: any) {
    console.error(`[GENERATE-IMPORT] Erreur extraction caractéristiques: ${error.message}`)
    // On continue avec le JSON de base si l'extraction échoue
  }

  // Marquer comme terminé
  updateStep(taskId, 'completed')

  return {
    success: true,
    json: finalJson,
    provider: prefilledJson && otherContents.length === 0 ? 'facebook-direct' : aiProvider,
    urlsProcessed: urls.length,
  }
}

/**
 * Appelle l'IA pour compléter un JSON pré-rempli avec des données supplémentaires
 */
async function callAIToCompleteJson(
  config: ReturnType<typeof useRuntimeConfig>,
  aiProvider: string,
  prefilledJson: FacebookImportJson,
  additionalContent: string
): Promise<string> {
  // Construire le prompt avec le JSON pré-rempli et les données supplémentaires
  const prefilledJsonStr = JSON.stringify(prefilledJson, null, 2)

  const userPrompt = additionalContent
    ? `JSON PRÉ-REMPLI (ne modifie pas les champs déjà remplis):\n${prefilledJsonStr}\n\nDONNÉES SUPPLÉMENTAIRES:\n${additionalContent}\n\nComplète le JSON:`
    : `JSON PRÉ-REMPLI (complète les champs vides):\n${prefilledJsonStr}\n\nComplète le JSON:`

  if (aiProvider === 'lmstudio') {
    return await callLMStudioComplete(
      config.lmstudioBaseUrl || 'http://localhost:1234',
      config.lmstudioTextModel || config.lmstudioModel || 'auto',
      userPrompt
    )
  } else if (aiProvider === 'anthropic' && config.anthropicApiKey) {
    return await callAnthropicComplete(config.anthropicApiKey, userPrompt)
  } else if (aiProvider === 'ollama') {
    return await callOllamaComplete(
      config.ollamaBaseUrl || 'http://localhost:11434',
      config.ollamaModel || 'llama3',
      userPrompt
    )
  } else {
    throw new Error(`Provider IA non configuré ou non supporté: ${aiProvider}`)
  }
}

/**
 * Appel LM Studio pour compléter un JSON (prompt optimisé)
 */
async function callLMStudioComplete(
  baseUrl: string,
  model: string,
  userPrompt: string
): Promise<string> {
  // Limiter le contenu pour LM Studio
  const maxContent = 1800
  const truncatedPrompt =
    userPrompt.length > maxContent
      ? userPrompt.substring(0, maxContent) + '\n...(tronqué)'
      : userPrompt

  console.log(
    `[GENERATE-IMPORT] LM Studio Complete: ${userPrompt.length} -> ${truncatedPrompt.length} caractères`
  )

  const response = await fetchWithTimeout(
    `${baseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PROMPT_COMPLETE_JSON },
          { role: 'user', content: truncatedPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    },
    LLM_TIMEOUT
  )

  if (!response.ok) {
    const error = await response.text()
    throw createError({ statusCode: 503, message: `Erreur LM Studio: ${error}` })
  }

  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ statusCode: 500, message: "L'IA n'a pas généré de JSON valide" })
  }

  try {
    JSON.parse(jsonMatch[0])
  } catch {
    throw createError({ statusCode: 500, message: "Le JSON généré par l'IA n'est pas valide" })
  }

  return jsonMatch[0]
}

/**
 * Appel Anthropic pour compléter un JSON
 */
async function callAnthropicComplete(apiKey: string, userPrompt: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: LLM_TIMEOUT })

  console.log('[GENERATE-IMPORT] Appel Anthropic Complete en cours...')
  const startTime = Date.now()

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: PROMPT_COMPLETE_JSON,
    messages: [{ role: 'user', content: userPrompt }],
  })

  console.log(`[GENERATE-IMPORT] Réponse Anthropic reçue en ${Date.now() - startTime}ms`)

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text)
    .join('')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ statusCode: 500, message: "L'IA n'a pas généré de JSON valide" })
  }

  return jsonMatch[0]
}

/**
 * Appel Ollama pour compléter un JSON
 */
async function callOllamaComplete(
  baseUrl: string,
  model: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${PROMPT_COMPLETE_JSON}\n\n${userPrompt}`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw createError({ statusCode: 503, message: `Erreur Ollama: ${response.statusText}` })
  }

  const data = await response.json()
  const responseText = data.response || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ statusCode: 500, message: "L'IA n'a pas généré de JSON valide" })
  }

  return jsonMatch[0]
}

/**
 * POST /api/admin/generate-import-json
 * Crée une tâche asynchrone et retourne immédiatement un taskId
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const { urls } = requestSchema.parse(body)

    // Créer une tâche asynchrone
    const task = createTask<GenerateImportResult>({ urls })

    console.log(`[GENERATE-IMPORT] Tâche créée: ${task.id} pour ${urls.length} URL(s)`)

    // Lancer la génération en arrière-plan
    runTaskInBackground(task.id, () => generateImportJson(urls, task.id))

    // Retourner immédiatement le taskId
    return {
      taskId: task.id,
      status: 'processing',
      message: 'Génération en cours...',
    }
  },
  { operationName: 'GenerateImportJson' }
)

/**
 * Appel à LM Studio (API compatible OpenAI) avec timeout
 * Utilise le prompt compact pour respecter la limite de contexte (4096 tokens)
 */
async function callLMStudio(baseUrl: string, model: string, content: string): Promise<string> {
  // Limiter le contenu pour LM Studio (contexte 4096 tokens ~ 3000 caractères max pour le contenu)
  const maxContent = 2000
  const truncatedContent =
    content.length > maxContent ? content.substring(0, maxContent) + '\n...(tronqué)' : content

  console.log(
    `[GENERATE-IMPORT] LM Studio: contenu ${content.length} -> ${truncatedContent.length} caractères`
  )

  let response: Response
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_COMPACT },
            {
              role: 'user',
              content: `Données:\n${truncatedContent}\n\nGénère le JSON:`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      },
      LLM_TIMEOUT
    )
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw createError({
        statusCode: 504,
        message: `Timeout LM Studio: le modèle n'a pas répondu dans les ${LLM_TIMEOUT / 1000} secondes. Essayez avec moins d'URLs ou un modèle plus rapide.`,
      })
    }
    throw createError({
      statusCode: 503,
      message: `Erreur de connexion à LM Studio: ${error.message}. Vérifiez que LM Studio est démarré.`,
    })
  }

  if (!response.ok) {
    const error = await response.text()
    throw createError({
      statusCode: 503,
      message: `Erreur LM Studio: ${error}. Vérifiez que LM Studio est démarré avec un modèle chargé.`,
    })
  }

  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || ''

  // Extraire le JSON de la réponse
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  // Valider que c'est un JSON valide
  try {
    JSON.parse(jsonMatch[0])
  } catch {
    throw createError({
      statusCode: 500,
      message: "Le JSON généré par l'IA n'est pas valide",
    })
  }

  return jsonMatch[0]
}

/**
 * Appel à l'API Anthropic avec timeout
 */
async function callAnthropic(apiKey: string, content: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey,
    timeout: LLM_TIMEOUT, // Timeout de 2 minutes
  })

  console.log('[GENERATE-IMPORT] Appel Anthropic en cours...')
  const startTime = Date.now()

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: SYSTEM_PROMPT_FULL,
    messages: [
      {
        role: 'user',
        content: `Voici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
      },
    ],
  })

  console.log(`[GENERATE-IMPORT] Réponse Anthropic reçue en ${Date.now() - startTime}ms`)

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text)
    .join('')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  return jsonMatch[0]
}

/**
 * Appel à Ollama
 */
async function callOllama(baseUrl: string, model: string, content: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: `${SYSTEM_PROMPT_FULL}\n\nVoici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw createError({
      statusCode: 503,
      message: `Erreur Ollama: ${response.statusText}`,
    })
  }

  const data = await response.json()
  const responseText = data.response || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  return jsonMatch[0]
}
