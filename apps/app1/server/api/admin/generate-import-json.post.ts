import { z } from 'zod'

import {
  generateCompactDirectPrompt,
  generateFeaturesDescription,
  generateJsonExample,
  generateProgramDayItemsPrompt,
  getPrefilledJsonPrompt,
} from '../../lib/import-json-schema'
import { loadPrompt } from '../../lib/prompt-loader'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import {
  AI_TIMEOUTS,
  getEffectiveAIConfigAsync,
  getMaxContentSizeForProvider,
} from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { createTask, runTaskInBackground, updateTaskMetadata } from '#server/utils/async-tasks'
import {
  extractEditionFeatures,
  mergeFeaturesIntoJson,
} from '#server/utils/edition-features-extractor'
import {
  facebookEventToImportJson,
  scrapeFacebookEvent,
  type FacebookImportJson,
} from '#server/utils/facebook-event-scraper'
import {
  BROWSER_HEADERS,
  ERREUR_EXPIRATION,
  fetchLocalModelWithTimeout,
  fetchWithBrowserless,
  fetchWithTimeout,
  isBrowserlessAvailable,
} from '#server/utils/fetch-helpers'
import {
  type ProgressCallback,
  sendStepEvent,
  sendUrlFetchedEvent,
  type GenerationStep as SSEGenerationStep,
} from '#server/utils/import-generation-sse'
import {
  isJugglingEdgeEventUrl,
  jugglingEdgeEventToImportJson,
  scrapeJugglingEdgeEvent,
} from '#server/utils/jugglingedge-scraper'
import { extractWebContent, formatExtractionForAI } from '#server/utils/web-content-extractor'
import { htmlVersTexte } from '~~/shared/utils/html-to-text'
import { editionDayKeys } from '~~/shared/utils/program-days'
import { construireElementsDeJournee, type ElementPropose } from '~~/shared/utils/program-import'
import { decouperParJournee } from '~~/shared/utils/program-page-slicing'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
  // Image trouvée lors du test (pour éviter de refaire une requête qui retourne une URL différente)
  previewedImageUrl: z.string().url().optional(),
})

// Type pour le résultat de la génération
export interface GenerateImportResult {
  success: boolean
  json: string
  provider: string
  urlsProcessed: number
  /**
   * Journées que la passe programme n'a pas pu relever, malgré une seconde tentative.
   *
   * Sans cette remontée, une journée perdue est indiscernable d'une journée sans changement :
   * l'écran ne montre rien dans les deux cas, et l'utilisateur croit la fonctionnalité muette.
   */
  programDayFailures?: string[]
}

// Note: getPrefilledJsonPrompt est importé depuis import-json-schema.ts (partagé ED/EI)

// Génère le prompt système complet pour Anthropic (modèles avec grand contexte)
function getFullSystemPrompt(): string {
  return loadPrompt('direct-full', {
    RULES_FULL: loadPrompt('rules-full'),
    FEATURES_DESCRIPTION: generateFeaturesDescription(),
    JSON_EXAMPLE: generateJsonExample(),
  })
}

/**
 * Étapes de la génération (pour le suivi côté frontend)
 */
export const GENERATION_STEPS = {
  scraping_facebook: 'Récupération des données Facebook...',
  scraping_jugglingedge: 'Récupération des données JugglingEdge...',
  fetching_urls: 'Récupération du contenu des URLs...',
  generating_json: 'Génération du JSON via IA...',
  extracting_program: 'Lecture du programme jour par jour...',
  extracting_features: 'Détection des services (camping, restauration, spectacles...)',
  completed: 'Terminé',
} as const

export type GenerationStep = keyof typeof GENERATION_STEPS

/**
 * Met à jour l'étape de la tâche (polling) et/ou envoie un événement SSE
 */
function updateStep(
  taskId: string | undefined,
  step: GenerationStep,
  onProgress?: ProgressCallback
): void {
  // Mode polling (ancien système)
  if (taskId) {
    updateTaskMetadata(taskId, {
      step,
      stepLabel: GENERATION_STEPS[step],
    })
  }
  // Mode SSE (nouveau système)
  if (onProgress) {
    sendStepEvent(onProgress, step as SSEGenerationStep)
  }
}

/**
 * Options pour la génération d'import JSON
 */
export interface GenerateImportOptions {
  /** ID de tâche pour le mode polling (ancien système) */
  taskId?: string
  /** Callback de progression pour le mode SSE (nouveau système) */
  onProgress?: ProgressCallback
  /** Image trouvée lors du test (pour éviter de refaire une requête qui retourne une URL différente) */
  previewedImageUrl?: string
  /** Provider IA à utiliser (optionnel, utilise la config serveur par défaut) */
  provider?: 'lmstudio' | 'anthropic' | 'ollama'
  /** Active la recherche des services (caractéristiques) via IA (true par défaut) */
  detectServices?: boolean
  /**
   * URL de la page décrivant le programme, quand l'édition en désigne une.
   *
   * Elle reçoit une passe dédiée : l'extraction générale partage son budget entre toutes les
   * sources, ce qui ne laissait qu'un quart d'un budget déjà réduit à une page de programme —
   * mesuré à 1,5 % de son contenu, insuffisant pour un déroulé de neuf jours.
   */
  programUrl?: string
  /**
   * Périmètre de l'extraction. Chaque volet coûte des minutes d'appels au modèle : les
   * informations générales interrogent toutes les sources, le programme une fois par journée de
   * convention. Pouvoir n'en demander qu'un raccourcit d'autant la séance.
   */
  extractInfos?: boolean
  extractProgram?: boolean
  /**
   * Bornes de l'édition, quand l'appelant les connaît. Elles font autorité pour décider quelles
   * journées existent — plus que celles proposées par le modèle, qui peuvent être erronées.
   */
  editionStartDate?: string
  editionEndDate?: string
  /**
   * Journées à relever. Chacune coûte un appel au modèle : n'en demander que celles qui manquent
   * raccourcit la séance d'autant. Absent ou vide vaut « toutes celles de l'édition ».
   */
  programDates?: string[]
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
  options: GenerateImportOptions = {}
): Promise<GenerateImportResult> {
  const {
    taskId,
    onProgress,
    previewedImageUrl,
    provider,
    detectServices = true,
    programUrl,
    extractInfos = true,
    extractProgram = true,
    editionStartDate,
    editionEndDate,
    programDates,
  } = options

  console.log(
    `[GENERATE-IMPORT] Périmètre: infos=${extractInfos}, programme=${extractProgram}, services=${detectServices}`
  )
  // Récupérer la config IA effective (BDD en priorité, fallback env)
  const effectiveConfig = await getEffectiveAIConfigAsync()

  const browserlessUrl = effectiveConfig.browserlessUrl
  const useBrowserless = browserlessUrl && (await isBrowserlessAvailable(browserlessUrl))

  if (useBrowserless) {
    console.log(`[GENERATE-IMPORT] Utilisation de browserless: ${browserlessUrl}`)
  } else {
    console.log('[GENERATE-IMPORT] Browserless non disponible, utilisation de fetch simple')
  }

  // Séparer les URLs par source de données structurées
  const facebookUrls = urls.filter((url) => url.includes('facebook.com/events'))
  const jugglingEdgeUrls = urls.filter((url) => isJugglingEdgeEventUrl(url))
  const otherUrls = urls.filter(
    (url) => !url.includes('facebook.com/events') && !isJugglingEdgeEventUrl(url)
  )

  console.log(
    `[GENERATE-IMPORT] URLs: Facebook=${facebookUrls.length}, JugglingEdge=${jugglingEdgeUrls.length}, Autres=${otherUrls.length}`
  )

  // Structure pour le JSON pré-rempli (depuis Facebook)
  let prefilledJson: FacebookImportJson | null = null

  // Étape 1: Traiter les URLs Facebook avec facebook-event-scraper
  //
  // La garde porte sur la BOUCLE, pas seulement sur l'annonce de l'étape : ne conditionner que
  // l'affichage laissait le relevé Facebook s'exécuter, et ses données étaient réinjectées plus
  // bas — description, dates, fuseau — donc proposées comme différences alors que personne
  // n'avait demandé les informations générales.
  if (extractInfos && facebookUrls.length > 0) {
    updateStep(taskId, 'scraping_facebook', onProgress)
  }

  for (const url of extractInfos ? facebookUrls : []) {
    try {
      console.log(`[GENERATE-IMPORT] Scraping Facebook Event: ${url}`)
      const fbEvent = await scrapeFacebookEvent(url)

      if (fbEvent) {
        console.log('[GENERATE-IMPORT] === Données Facebook Event Scraper ===')
        console.log(JSON.stringify(fbEvent, null, 2))
        console.log('[GENERATE-IMPORT] === Fin données Facebook ===')

        // Convertir en JSON d'import pré-rempli
        prefilledJson = await facebookEventToImportJson(fbEvent)
        console.log('[GENERATE-IMPORT] JSON pré-rempli depuis Facebook:')
        console.log(JSON.stringify(prefilledJson, null, 2))

        // On ne traite qu'une seule URL Facebook (la première avec des données)
        break
      }
    } catch (error: any) {
      console.error(`[GENERATE-IMPORT] Erreur scraping Facebook ${url}: ${error.message}`)
    }
  }

  // Étape 1b: Si pas de données Facebook, essayer JugglingEdge
  if (extractInfos && !prefilledJson && jugglingEdgeUrls.length > 0) {
    updateStep(taskId, 'scraping_jugglingedge', onProgress)

    for (const url of jugglingEdgeUrls) {
      try {
        console.log(`[GENERATE-IMPORT] Scraping JugglingEdge Event: ${url}`)
        const jeEvent = await scrapeJugglingEdgeEvent(url)

        if (jeEvent) {
          console.log('[GENERATE-IMPORT] === Données JugglingEdge JSON-LD ===')
          console.log(JSON.stringify(jeEvent, null, 2))
          console.log('[GENERATE-IMPORT] === Fin données JugglingEdge ===')

          // Convertir en JSON d'import pré-rempli
          prefilledJson = jugglingEdgeEventToImportJson(jeEvent)
          console.log('[GENERATE-IMPORT] JSON pré-rempli depuis JugglingEdge:')
          console.log(JSON.stringify(prefilledJson, null, 2))

          // On ne traite qu'une seule URL JugglingEdge (la première avec des données)
          break
        }
      } catch (error: any) {
        console.error(`[GENERATE-IMPORT] Erreur scraping JugglingEdge ${url}: ${error.message}`)
      }
    }
  }

  // Étape 2: Récupérer le contenu des autres URLs
  const otherContents: string[] = []
  // Contenu de la page du programme, conservé à part et sans partage de budget.
  let programPageContent: string | null = null
  // Stocker les images OG trouvées pour les injecter plus tard (l'IA peut halluciner les URLs)
  const foundOgImages: string[] = []

  // Provider IA à utiliser (paramètre > config serveur > défaut)
  const aiProvider = provider || effectiveConfig.aiProvider || 'lmstudio'
  console.log(`[GENERATE-IMPORT] Provider IA sélectionné: ${aiProvider}`)
  const dynamicMaxContent = await getMaxContentSizeForProvider(
    aiProvider,
    effectiveConfig.lmstudioBaseUrl
  )
  // Réduire si on a déjà un JSON pré-rempli (moins besoin de contenu)
  const totalContentBudget = prefilledJson ? Math.floor(dynamicMaxContent * 0.6) : dynamicMaxContent
  const maxContentPerUrl =
    otherUrls.length > 0 ? Math.floor(totalContentBudget / otherUrls.length) : totalContentBudget

  console.log(
    `[GENERATE-IMPORT] Budget contenu: ${totalContentBudget} chars (provider: ${aiProvider}, prefilled: ${!!prefilledJson})`
  )

  if (otherUrls.length > 0) {
    updateStep(taskId, 'fetching_urls', onProgress)
  }

  for (const url of otherUrls) {
    // Les pages nourrissent aussi bien l'extraction générale que la détection des services.
    // Si ni l'une ni l'autre n'est demandée, seule la page du programme reste utile.
    if (!extractInfos && !detectServices && url !== programUrl) continue
    try {
      let html: string

      if (useBrowserless) {
        html = await fetchWithBrowserless(browserlessUrl, url, {
          timeout: AI_TIMEOUTS.URL_FETCH,
          waitForNetworkIdle: true,
        })
        console.log(
          `[GENERATE-IMPORT] HTML récupéré via browserless pour ${url}: ${html.length} caractères`
        )
      } else {
        const response = await fetchWithTimeout(
          url,
          { headers: BROWSER_HEADERS },
          AI_TIMEOUTS.URL_FETCH
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        html = await response.text()
      }

      // Extraire le contenu structuré du HTML
      const extraction = extractWebContent(html, url)
      const textContent = formatExtractionForAI(extraction, maxContentPerUrl)
      otherContents.push(textContent)

      // La page du programme est en plus conservée entière — à hauteur du budget complet — pour
      // la passe dédiée. Sa part dans l'extraction générale reste inchangée.
      if (programUrl && url === programUrl) {
        // Texte brut, et non l'extraction structurée : celle-ci résume la page pour la faire
        // tenir dans un prompt — 5 164 caractères tirés de 63 536 — et les dernières journées de
        // la convention y disparaissaient. C'est le bon comportement pour décrire un événement,
        // le mauvais pour relever un déroulé heure par heure. La passe découpe ce texte et
        // n'envoie qu'une section par appel : elle n'a pas besoin qu'il tienne dans un prompt.
        // Plafond de sécurité, sans rapport avec le budget du modèle : il borne ce qu'on garde
        // en mémoire et balaie, pour qu'une page pathologique ne coûte pas plus qu'un programme.
        programPageContent = htmlVersTexte(html).slice(0, 200_000)
        console.log(
          `[GENERATE-IMPORT] Page programme conservée pour la passe dédiée: ${programPageContent.length} caractères`
        )
      }

      // Stocker l'image OG si trouvée (pour la réinjecter après la génération IA)
      if (extraction.openGraph.image) {
        console.log(`[GENERATE-IMPORT] Image OG trouvée: ${extraction.openGraph.image}`)
        foundOgImages.push(extraction.openGraph.image)
      }

      // Notifier la progression SSE
      if (onProgress) {
        sendUrlFetchedEvent(onProgress, url)
      }
    } catch (error: any) {
      const errorMsg =
        error.name === 'AbortError'
          ? `Timeout après ${AI_TIMEOUTS.URL_FETCH / 1000}s`
          : error.message
      console.error(`[GENERATE-IMPORT] Erreur fetch ${url}: ${errorMsg}`)
      otherContents.push(
        `=== Erreur pour ${url} ===\nImpossible de récupérer le contenu: ${errorMsg}`
      )
    }
  }

  let generatedJson: string

  // Étape 3: Générer ou compléter le JSON via IA
  if (!extractInfos) {
    // Seul le programme est demandé : on part d'une édition vide, que la passe dédiée remplira.
    // L'écran de comparaison ne propose que les champs présents, les autres restent intacts.
    console.log("[GENERATE-IMPORT] Informations générales non demandées, pas d'appel au modèle")
    generatedJson = JSON.stringify({ edition: {} }, null, 2)
  } else if (prefilledJson && otherContents.length === 0) {
    updateStep(taskId, 'generating_json', onProgress)
    // Cas 1: Uniquement Facebook, pas d'IA - retourne le JSON tel quel
    console.log("[GENERATE-IMPORT] Facebook seul, pas d'IA")
    generatedJson = JSON.stringify(prefilledJson, null, 2)
  } else if (prefilledJson && otherContents.length > 0) {
    // Cas 2: Facebook + autres URLs - demander à l'IA de compléter convention.name, convention.email et autres champs vides
    console.log('[GENERATE-IMPORT] Facebook + autres URLs, IA complète les champs manquants')
    const combinedOtherContent = otherContents.join('\n\n')
    generatedJson = await callAIToCompleteJson(
      effectiveConfig,
      aiProvider,
      prefilledJson,
      combinedOtherContent,
      dynamicMaxContent
    )
  } else {
    // Cas 3: Pas de Facebook - extraction complète par l'IA
    console.log("[GENERATE-IMPORT] Pas de Facebook, extraction complète par l'IA")
    const combinedContent = otherContents.join('\n\n')

    if (aiProvider === 'lmstudio') {
      generatedJson = await callLMStudio(
        basesLmStudio(effectiveConfig),
        effectiveConfig.lmstudioTextModel || effectiveConfig.lmstudioModel || 'auto',
        combinedContent,
        dynamicMaxContent,
        effectiveConfig.llmTimeoutMs ?? AI_TIMEOUTS.LLM_REQUEST
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
  // (étape ignorée si la recherche des services est désactivée)
  const detecterServices = detectServices
  if (detecterServices) {
    updateStep(taskId, 'extracting_features', onProgress)
  }

  let finalJson = generatedJson
  try {
    const parsedJson = JSON.parse(generatedJson)

    // Post-traitement: Injecter l'image trouvée lors du test ou extraite programmatiquement
    // Priorité: 1) previewedImageUrl (du test) 2) foundOgImages (de l'extraction)
    // L'IA peut halluciner des URLs différentes, donc on utilise l'image du test en priorité
    const imageToInject = previewedImageUrl || (foundOgImages.length > 0 ? foundOgImages[0] : null)
    if (imageToInject) {
      const currentImageUrl = parsedJson.edition?.imageUrl || ''

      // Si pas d'image ou image différente de celle trouvée, utiliser celle du test/extraction
      if (!currentImageUrl || currentImageUrl !== imageToInject) {
        console.log(
          `[GENERATE-IMPORT] Injection de l'image (IA: "${currentImageUrl}" -> ${previewedImageUrl ? 'Test' : 'Extraction'}: "${imageToInject}")`
        )
        if (!parsedJson.edition) parsedJson.edition = {}
        parsedJson.edition.imageUrl = imageToInject
        generatedJson = JSON.stringify(parsedJson, null, 2)
      }
    }

    // Post-traitement: Réinjecter les données Facebook fiables (description, dates, timezone)
    // L'IA peut tronquer ou modifier ces champs — les données Facebook sont la source de vérité
    if (prefilledJson) {
      if (!parsedJson.edition) parsedJson.edition = {}
      const fb = prefilledJson.edition

      // Description complète (l'IA la tronque souvent)
      if (fb.description) {
        parsedJson.edition.description = fb.description
      }

      // Dates et heures (Facebook fournit des dates précises avec heures)
      if (fb.startDate) parsedJson.edition.startDate = fb.startDate
      if (fb.endDate) parsedJson.edition.endDate = fb.endDate

      // Timezone
      if (fb.timezone) parsedJson.edition.timezone = fb.timezone

      generatedJson = JSON.stringify(parsedJson, null, 2)
      console.log('[GENERATE-IMPORT] Données Facebook réinjectées (description, dates, timezone)')
    }

    if (!detecterServices) {
      console.log('[GENERATE-IMPORT] Recherche des services désactivée, étape ignorée')
      finalJson = generatedJson // Utiliser le JSON avec l'image corrigée
    } else {
      // Sans extraction générale il n'y a pas de description produite par le modèle. Le contenu
      // récupéré des pages fait alors office de matière : les services y sont mentionnés de toute
      // façon, c'est de là que la description elle-même serait tirée.
      const description =
        parsedJson.edition?.description || (extractInfos ? '' : otherContents.join('\n\n'))

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
          finalJson = generatedJson // Utiliser le JSON avec l'image corrigée
        }
      } else {
        console.log('[GENERATE-IMPORT] Description trop courte pour extraire les caractéristiques')
        finalJson = generatedJson // Utiliser le JSON avec l'image corrigée
      }
    }
  } catch (error: any) {
    console.error(`[GENERATE-IMPORT] Erreur extraction caractéristiques: ${error.message}`)
    // On continue avec le JSON de base si l'extraction échoue
  }

  /** Journées que la passe n'a pas pu relever : elles doivent être dites, pas tues. */
  let journeesEnEchec: string[] = []

  // Passe dédiée au programme jour par jour, sur la seule page du programme.
  if (extractProgram && programPageContent) {
    try {
      const parsed = JSON.parse(finalJson)
      // Les dates de l'édition font autorité quand l'appelant les connaît : celles proposées par
      // le modèle peuvent être fausses, et décideraient alors quelles journées existent.
      const debut = String(editionStartDate || parsed?.edition?.startDate || '').slice(0, 10)
      const fin = String(editionEndDate || parsed?.edition?.endDate || '').slice(0, 10)

      // Sans les bornes, le modèle n'a aucun moyen de dater des journées désignées par leur nom,
      // et rien ne permettrait d'écarter celles qui tombent hors de l'édition.
      if (/^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin)) {
        updateStep(taskId, 'extracting_program', onProgress)
        const resultat = await extractProgramDays(
          effectiveConfig,
          aiProvider,
          programPageContent,
          debut,
          fin,
          dynamicMaxContent,
          onProgress,
          programDates
        )
        journeesEnEchec = resultat.echecs
        if (resultat.elements.length > 0) {
          console.log(
            `[GENERATE-IMPORT] Programme: ${resultat.elements.length} élément(s) relevé(s)` +
              (resultat.ignores ? `, ${resultat.ignores} écarté(s) faute de titre ou d'heure` : '')
          )
          // Des éléments, et non plus du texte par journée : le programme se compose désormais
          // d'entrées structurées, que l'écran de revue compare une à une à ce qui existe déjà.
          parsed.edition = { ...parsed.edition, programItems: resultat.elements }
        } else {
          console.log('[GENERATE-IMPORT] Programme: aucune journée extraite')
        }
        if (resultat.echecs.length > 0) {
          console.warn(
            `[GENERATE-IMPORT] Programme: ${resultat.echecs.length} journée(s) en échec — ${resultat.echecs.join(', ')}`
          )
        }
      } else {
        console.log(
          `[GENERATE-IMPORT] Programme ignoré: dates d'édition inexploitables (${debut} → ${fin})`
        )
      }
    } catch (error: any) {
      // Un échec ici ne doit pas perdre le reste de l'extraction, qui a déjà coûté plusieurs
      // minutes. Le programme est un complément, pas le cœur du résultat.
      //
      // Mais il doit se voir : sans cela, une passe entièrement tombée serait indiscernable d'une
      // analyse sans changement — le défaut même qu'on vient de corriger, un cran plus haut.
      console.error(`[GENERATE-IMPORT] Erreur passe programme: ${error.message}`)
      if (journeesEnEchec.length === 0) {
        journeesEnEchec = programDates?.length
          ? [...programDates]
          : editionDayKeys(editionStartDate || '', editionEndDate || '')
      }
    }
  }

  // Marquer comme terminé
  updateStep(taskId, 'completed', onProgress)

  return {
    success: true,
    json: finalJson,
    provider: prefilledJson && otherContents.length === 0 ? 'facebook-direct' : aiProvider,
    urlsProcessed: urls,
    programDayFailures: journeesEnEchec,
  }
}

/**
 * Passe dédiée : extrait le programme jour par jour d'une seule page.
 *
 * Séparée de l'extraction générale parce que celle-ci partage son budget de contenu entre toutes
 * les sources. Une page de programme n'en recevait qu'un quart d'un budget déjà réduit — mesuré à
 * 1,5 % de la page sur une convention de neuf jours — et aucune journée n'en ressortait. Ici la
 * page est seule et on ne demande qu'une chose.
 *
 * Le retour du modèle est filtré plutôt que cru : une journée hors des dates de l'édition ne
 * pourrait pas s'afficher, et une date inventée vaut mieux écartée que proposée.
 */
async function extractProgramDays(
  config: EffectiveAIConfig,
  aiProvider: string,
  pageContent: string,
  startDate: string,
  endDate: string,
  maxContent: number,
  onProgress?: ProgressCallback,
  datesDemandees?: string[]
): Promise<{ elements: ElementPropose[]; echecs: string[]; ignores: number }> {
  const timeoutMs = config.llmTimeoutMs ?? AI_TIMEOUTS.LLM_REQUEST
  // On découpe la page ENTIÈRE : tronquer avant amputerait les dernières journées. Seule la
  // matière envoyée au modèle, une section à la fois, est ramenée à son budget.
  const contenu = pageContent

  // Les journées demandées, intersectées avec celles de l'édition : une date fantaisiste ne doit
  // pas engendrer un appel au modèle pour une journée qui n'existe pas.
  const toutesLesJournees = editionDayKeys(startDate, endDate)
  const jours = datesDemandees?.length
    ? toutesLesJournees.filter((j) => datesDemandees.includes(j))
    : toutesLesJournees
  if (datesDemandees?.length) {
    console.log(
      `[GENERATE-IMPORT] Programme: ${jours.length} journée(s) demandée(s) sur ${toutesLesJournees.length}`
    )
  }
  // Une convention démesurément longue viendrait d'une saisie fautive et coûterait autant d'appels
  // au modèle. On s'arrête, en le disant plutôt qu'en tronquant en silence.
  const MAX_JOURNEES = 31
  const aTraiter = jours.slice(0, MAX_JOURNEES)
  if (jours.length > aTraiter.length) {
    console.warn(
      `[GENERATE-IMPORT] Programme: ${jours.length} jours, seules les ${MAX_JOURNEES} premières journées sont interrogées`
    )
  }

  console.log(
    `[GENERATE-IMPORT] Passe programme: ${contenu.length} caractères, ${aTraiter.length} journée(s) à interroger (${startDate} → ${endDate})`
  )

  const retenus: ElementPropose[] = []
  let ignoresTotal = 0
  /** Journées perdues malgré la seconde tentative, remontées jusqu'à l'écran. */
  const echecs: string[] = []

  // Repérer les sections coûte zéro appel au modèle. Sans ça, il relisait toute la page à chaque
  // journée : neuf lectures de la même page pour en tirer neuf extraits.
  // Les descripteurs couvrent TOUTES les journées de l'édition, même non demandées : une section
  // court jusqu'au repère de la journée suivante, et sans ce repère elle s'étendrait jusqu'au bout
  // de la page. C'est ce qui arrivait en ne demandant que les deux premiers jours — la seconde
  // section faisait 6 077 caractères au lieu de 700. Le rang annoncé au modèle est également
  // celui de la convention entière : « jour 2 sur 9 », et non « jour 2 sur 2 ».
  const descripteurs = toutesLesJournees.map((date, i) => {
    const midi = new Date(`${date}T12:00:00Z`)
    return {
      date,
      jourFr: midi.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' }),
      jourEn: midi.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
      index: i + 1,
    }
  })
  const sections = decouperParJournee(contenu, descripteurs)
  const localiseesDemandees = aTraiter.filter((date) => sections[date]).length
  console.log(
    `[GENERATE-IMPORT] Programme: ${localiseesDemandees}/${aTraiter.length} journée(s) demandée(s) localisée(s) dans la page`
  )

  /**
   * Nombre de journées interrogées de front.
   *
   * Mesuré sur neuf journées avec un modèle local : 730 s en séquentiel, 446 puis 458 s à trois,
   * 393 s à cinq. Le gain de trois à cinq est réel, mais cette exécution-là a perdu une journée
   * sur un `UND_ERR_HEADERS_TIMEOUT` — le modèle n'a pas répondu à temps, saturé. Une minute
   * gagnée ne vaut pas une journée perdue, d'où trois.
   *
   * Ce plafond protège une machine modeste ; un fournisseur hébergé en supporterait bien
   * davantage. À revoir le jour où le choix du fournisseur pourra l'ajuster.
   */
  const CONCURRENCE = 3

  const traiterJournee = async (date: string) => {
    // Garde plutôt qu'une assertion : levée ici, hors du try, l'exception ferait rejeter le
    // travailleur puis `Promise.all`, et emporterait toute la passe — l'inverse de l'isolation
    // par journée qu'on cherche.
    const descripteur = descripteurs.find((d) => d.date === date)
    if (!descripteur) {
      console.warn(`[GENERATE-IMPORT] Programme ${date}: journée sans descripteur, ignorée`)
      return
    }
    const systemPrompt = generateProgramDayItemsPrompt({
      date,
      jourFr: descripteur.jourFr,
      jourEn: descripteur.jourEn,
      index: descripteur.index,
      total: toutesLesJournees.length,
      startDate,
      endDate,
    })

    // La section si on l'a trouvée, la page entière sinon : mieux vaut une lecture lente qu'une
    // section fausse.
    const section = sections[date] || contenu
    const matiere =
      section.length > maxContent ? section.substring(0, maxContent) + '\n...(tronqué)' : section

    try {
      // Une seconde tentative avant d'abandonner : les échecs observés sont transitoires — un
      // modèle occupé qui ne répond pas à temps — et perdre une journée pour cela serait dommage
      // alors qu'on a déjà payé la lecture de la page.
      let brut: string
      try {
        brut = await appelerModele(config, aiProvider, systemPrompt, matiere, timeoutMs)
      } catch (premiereErreur: any) {
        // Pas de seconde tentative après une expiration : le délai est déjà généreux — trente
        // minutes chez certains — et réessayer doublerait l'attente pour le même résultat. On ne
        // réessaie que les échecs rapides, connexion refusée ou en-têtes non reçus, qui sont ceux
        // qu'on observe quand le modèle est momentanément occupé.
        if (premiereErreur?.[ERREUR_EXPIRATION] === true) throw premiereErreur

        console.warn(
          `[GENERATE-IMPORT] Programme ${date}: première tentative échouée (${premiereErreur.message}), nouvel essai`
        )
        await new Promise((resoudre) => setTimeout(resoudre, 2000))
        brut = await appelerModele(config, aiProvider, systemPrompt, matiere, timeoutMs)
      }
      const { elements, ignores } = construireElementsDeJournee(date, lireElementsJournee(brut))
      ignoresTotal += ignores
      if (elements.length > 0) {
        // La fidélité se mesure désormais sur les titres : chacun doit figurer mot pour mot dans
        // la page. Un titre absent de la source est un titre inventé, et c'est le risque propre à
        // une extraction structurée — le modèle n'y recopie plus, il interprète.
        const repris = elements.filter((e) => matiere.includes(e.titre)).length
        console.log(
          `[GENERATE-IMPORT] Programme ${date}: ${elements.length} élément(s), ${repris} titre(s) retrouvé(s) mot pour mot, ${ignores} écarté(s) (matière ${matiere.length})`
        )
        retenus.push(...elements)
      }

      if (onProgress) {
        const libelle = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        })
        const combien = construireElementsDeJournee(date, lireElementsJournee(brut)).elements.length
        sendUrlFetchedEvent(
          onProgress,
          combien ? `${libelle} — ${combien} élément(s)` : `${libelle} — rien à cette date`
        )
      }
    } catch (error: any) {
      // Une journée qui échoue ne doit pas emporter les autres : chacune est indépendante. Mais
      // elle doit se voir : sans cela, une journée perdue est indiscernable d'une journée sans
      // changement, et l'écran ne montre rien dans les deux cas.
      console.error(`[GENERATE-IMPORT] Programme ${date}: ${error.message}`)
      echecs.push(date)
      if (onProgress) sendUrlFetchedEvent(onProgress, `${date} — échec`)
    }
  }

  // File partagée entre quelques travailleurs : les journées ne se répartissent pas d'avance,
  // leurs durées étant très inégales — une journée creuse répond en secondes, une journée dense
  // en minutes.
  const enAttente = [...aTraiter]
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCE, enAttente.length) }, async () => {
      // `!== undefined` et non une simple vérité : la file est vide quand `shift` ne rend rien,
      // pas quand une valeur est vide.
      for (let date = enAttente.shift(); date !== undefined; date = enAttente.shift()) {
        await traiterJournee(date)
      }
    })
  )

  // L'ordre d'arrivée dépend des durées et de la concurrence : on rétablit celui du calendrier.
  return {
    elements: retenus.sort((a, b) => a.debut.localeCompare(b.debut)),
    echecs: echecs.sort(),
    ignores: ignoresTotal,
  }
}

/**
 * Lit la liste `items` d'une réponse de journée, en tolérant du bavardage autour du JSON.
 *
 * On ne valide rien ici : la mise en forme et le tri du bon grain reviennent à
 * `construireElementsDeJournee`, qui se teste sans modèle.
 */
function lireElementsJournee(reponse: string): unknown {
  const match = reponse.match(/\{[\s\S]*\}/)
  if (!match) return []
  try {
    const objet = JSON.parse(match[0]) as { items?: unknown }
    return objet?.items ?? []
  } catch {
    return []
  }
}

/**
 * Adresses LM Studio à essayer, dans l'ordre.
 *
 * La seconde n'est tentée que si la première est injoignable — machine éteinte, port fermé. Une
 * adresse vide vient d'un champ laissé blanc et ne compte pas.
 */
function basesLmStudio(config: EffectiveAIConfig): string[] {
  return [
    config.lmstudioBaseUrl || 'http://localhost:1234',
    config.lmstudioBackupBaseUrl || '',
  ].filter((b) => b.trim() !== '')
}

/** Un appel au modèle, quel que soit le fournisseur configuré. */
async function appelerModele(
  config: EffectiveAIConfig,
  aiProvider: string,
  systemPrompt: string,
  contenu: string,
  timeoutMs: number
): Promise<string> {
  let reponse: string

  if (aiProvider === 'anthropic' && config.anthropicApiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: timeoutMs })
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: contenu }],
    })
    reponse = message.content[0]?.type === 'text' ? message.content[0].text : ''
  } else if (aiProvider === 'ollama') {
    const res = await fetchLocalModelWithTimeout(
      `${config.ollamaBaseUrl || 'http://localhost:11434'}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'llama3',
          prompt: `${systemPrompt}\n\n${contenu}`,
          stream: false,
        }),
      },
      timeoutMs,
      'Ollama'
    )
    reponse = (await res.json()).response || ''
  } else {
    const res = await fetchLocalModelAvecSecours(
      basesLmStudio(config),
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.lmstudioTextModel || config.lmstudioModel || 'auto',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contenu },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      },
      timeoutMs,
      'LM Studio'
    )
    reponse = (await res.json()).choices?.[0]?.message?.content || ''
  }

  return reponse
}

/**
 * Appelle l'IA pour compléter un JSON pré-rempli avec des données supplémentaires
 */
async function callAIToCompleteJson(
  config: EffectiveAIConfig,
  aiProvider: string,
  prefilledJson: FacebookImportJson,
  additionalContent: string,
  maxContent: number
): Promise<string> {
  // Retirer les champs Facebook fiables du JSON envoyé à l'IA pour économiser des tokens
  // Ces champs seront réinjectés dans le post-traitement (description, dates, timezone)
  const lightJson = JSON.parse(JSON.stringify(prefilledJson))
  const removedFields: string[] = []
  if (lightJson.edition?.description) {
    lightJson.edition.description = '(fourni par Facebook, ne pas remplir)'
    removedFields.push('description')
  }
  if (lightJson.edition?.startDate) {
    removedFields.push('startDate')
  }
  if (lightJson.edition?.endDate) {
    removedFields.push('endDate')
  }
  if (lightJson.edition?.timezone) {
    removedFields.push('timezone')
  }

  if (removedFields.length > 0) {
    console.log(
      `[GENERATE-IMPORT] Champs Facebook retirés du prompt IA: ${removedFields.join(', ')}`
    )
  }

  const prefilledJsonStr = JSON.stringify(lightJson, null, 2)

  const userPrompt = additionalContent
    ? `JSON PRÉ-REMPLI (ne modifie pas les champs déjà remplis):\n${prefilledJsonStr}\n\nDONNÉES SUPPLÉMENTAIRES:\n${additionalContent}\n\nComplète les champs vides du JSON:`
    : `JSON PRÉ-REMPLI (complète les champs vides):\n${prefilledJsonStr}\n\nComplète les champs vides du JSON:`

  if (aiProvider === 'lmstudio') {
    return await callLMStudioComplete(
      basesLmStudio(config),
      config.lmstudioTextModel || config.lmstudioModel || 'auto',
      userPrompt,
      maxContent,
      // Le délai réglé dans /admin/ai-config était ignoré ici : seule la variable
      // d'environnement s'appliquait, et l'augmenter depuis l'écran ne changeait rien.
      config.llmTimeoutMs ?? AI_TIMEOUTS.LLM_REQUEST
    )
  } else if (aiProvider === 'anthropic' && config.anthropicApiKey) {
    return await callAnthropicComplete(config.anthropicApiKey, userPrompt)
  } else if (aiProvider === 'ollama') {
    return await callOllamaComplete(
      config.ollamaBaseUrl || 'http://localhost:11434',
      config.ollamaModel || 'llama3',
      userPrompt,
      config.llmTimeoutMs ?? AI_TIMEOUTS.LLM_REQUEST
    )
  } else {
    throw new Error(`Provider IA non configuré ou non supporté: ${aiProvider}`)
  }
}

/**
 * Appel LM Studio pour compléter un JSON (prompt optimisé)
 */
async function callLMStudioComplete(
  bases: string[],
  model: string,
  userPrompt: string,
  maxContent: number,
  timeoutMs: number = AI_TIMEOUTS.LLM_REQUEST
): Promise<string> {
  // Limiter le contenu selon le context length du modèle
  const truncatedPrompt =
    userPrompt.length > maxContent
      ? userPrompt.substring(0, maxContent) + '\n...(tronqué)'
      : userPrompt

  console.log(
    `[GENERATE-IMPORT] LM Studio Complete: ${userPrompt.length} -> ${truncatedPrompt.length} caractères (max: ${maxContent})`
  )

  // Passe par le helper plutôt que par `fetchWithTimeout` : sans lui, l'expiration remonte le
  // message brut d'undici, « This operation was aborted », qui ne dit ni ce qui a expiré ni quoi
  // y faire. C'est ce que voyait l'utilisateur.
  // Le catch n'est pas décoratif : sans lui, une Error simple remonte à Nitro, qui masque son
  // message en « Internal Server Error » — l'utilisateur perdrait l'explication du helper.
  let response: Response
  try {
    response = await fetchLocalModelAvecSecours(
      bases,
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: getPrefilledJsonPrompt() },
            { role: 'user', content: truncatedPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      },
      timeoutMs,
      'LM Studio'
    )
  } catch (error: any) {
    throw createError({
      status: error?.[ERREUR_EXPIRATION] === true ? 504 : 503,
      message: error.message,
    })
  }

  // Pas de contrôle de `response.ok` ici : le helper ne rend qu'une réponse servie, et traduit
  // lui-même un refus en message lisible. Le recopier ici rendrait le JSON brut de l'API.
  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ status: 500, message: "L'IA n'a pas généré de JSON valide" })
  }

  try {
    JSON.parse(jsonMatch[0])
  } catch {
    throw createError({ status: 500, message: "Le JSON généré par l'IA n'est pas valide" })
  }

  return jsonMatch[0]
}

/**
 * Appel Anthropic pour compléter un JSON
 */
async function callAnthropicComplete(apiKey: string, userPrompt: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: AI_TIMEOUTS.LLM_REQUEST })

  console.log('[GENERATE-IMPORT] Appel Anthropic Complete en cours...')
  const startTime = Date.now()

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: getPrefilledJsonPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
  })

  console.log(`[GENERATE-IMPORT] Réponse Anthropic reçue en ${Date.now() - startTime}ms`)

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text)
    .join('')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ status: 500, message: "L'IA n'a pas généré de JSON valide" })
  }

  return jsonMatch[0]
}

/**
 * Appel Ollama pour compléter un JSON
 */
async function callOllamaComplete(
  baseUrl: string,
  model: string,
  userPrompt: string,
  timeoutMs: number = AI_TIMEOUTS.LLM_REQUEST
): Promise<string> {
  // `fetch` nu, sans délai : un modèle qui ne répond jamais laissait la requête suspendue
  // indéfiniment, sans message ni fin.
  const response = await fetchLocalModelWithTimeout(
    `${baseUrl}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${getPrefilledJsonPrompt()}\n\n${userPrompt}`,
        stream: false,
      }),
    },
    timeoutMs,
    'Ollama'
  )

  if (!response.ok) {
    throw createError({ status: 503, message: `Erreur Ollama: ${response.statusText}` })
  }

  const data = await response.json()
  const responseText = data.response || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({ status: 500, message: "L'IA n'a pas généré de JSON valide" })
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
    runTaskInBackground(task.id, () => generateImportJson(urls, { taskId: task.id }))

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
 * Utilise le prompt compact pour respecter la limite de contexte
 */
async function callLMStudio(
  bases: string[],
  model: string,
  content: string,
  maxContent: number,
  // Délai réglable depuis /admin/ai-config : un modèle local lent s'accommode mal des 3 minutes
  // par défaut, et l'administrateur doit pouvoir l'ajuster sans redéploiement.
  timeoutMs: number = AI_TIMEOUTS.LLM_REQUEST
): Promise<string> {
  // Limiter le contenu selon le context length du modèle
  const truncatedContent =
    content.length > maxContent ? content.substring(0, maxContent) + '\n...(tronqué)' : content

  console.log(
    `[GENERATE-IMPORT] LM Studio: contenu ${content.length} -> ${truncatedContent.length} caractères (max: ${maxContent})`
  )

  let response: Response
  try {
    // Passe par la bascule : le helper essaie l'adresse de secours si la première est
    // injoignable, et traduit déjà expiration et panne de connexion en messages explicites.
    response = await fetchLocalModelAvecSecours(
      bases,
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: generateCompactDirectPrompt() },
            {
              role: 'user',
              content: `Données:\n${truncatedContent}\n\nGénère le JSON:`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      },
      timeoutMs,
      'LM Studio'
    )
  } catch (error: any) {
    throw createError({
      status: error?.[ERREUR_EXPIRATION] === true ? 504 : 503,
      message: error.message,
    })
  }

  // Voir plus haut : le helper garantit une réponse servie, et dit déjà quoi faire en cas de refus.
  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || ''

  // Extraire le JSON de la réponse
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      status: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  // Valider que c'est un JSON valide
  try {
    JSON.parse(jsonMatch[0])
  } catch {
    throw createError({
      status: 500,
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
    timeout: AI_TIMEOUTS.LLM_REQUEST, // Timeout de 2 minutes
  })

  console.log('[GENERATE-IMPORT] Appel Anthropic en cours...')
  const startTime = Date.now()

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: getFullSystemPrompt(),
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
      status: 500,
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
      prompt: `${getFullSystemPrompt()}\n\nVoici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw createError({
      status: 503,
      message: `Erreur Ollama: ${response.statusText}`,
    })
  }

  const data = await response.json()
  const responseText = data.response || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      status: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  return jsonMatch[0]
}
