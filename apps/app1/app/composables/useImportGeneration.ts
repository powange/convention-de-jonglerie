/**
 * Composable pour la génération d'imports via SSE
 *
 * Encapsule la logique de génération de JSON depuis des URLs
 * avec support des méthodes "simple" et "agent".
 */

import type { StepHistoryEntry, SubStepEntry } from '~/composables/useElapsedTimer'

import { buildGenerationStreamUrl } from '~~/shared/utils/generation-stream-url'

/**
 * Méthodes de génération disponibles
 */
export type GenerationMethod = 'simple' | 'agent'

/**
 * Provider IA disponible
 */
export interface AIProvider {
  id: string
  name: string
  description: string
  icon: string
  isDefault: boolean
}

/**
 * Résultat de la génération SSE
 */
export interface GenerationResult {
  success: boolean
  json: string
  provider: string
  urlsProcessed?: string[]
  iterations?: number
  /** Journées de programme que le modèle n'a pas pu relever, à signaler à l'utilisateur. */
  programDayFailures?: string[]
}

/**
 * Options de configuration du composable
 */
export interface UseImportGenerationOptions {
  /** Callback appelé lors d'un changement d'étape */
  onStepChange?: (step: string, label: string) => void
  /** Callback appelé lors de la récupération d'une URL */
  onUrlFetched?: (url: string) => void
  /** Callback appelé à la fin de la génération */
  onComplete?: (result: GenerationResult) => void
  /** Callback appelé en cas d'erreur */
  onError?: (error: string) => void
  /** Plafond absolu en ms, dernier recours (par défaut: 30 minutes) */
  timeout?: number
  /** Silence toléré entre deux événements du flux avant d'abandonner (par défaut: 60 s) */
  silenceTimeout?: number
}

/**
 * Composable pour gérer la génération de JSON d'import via SSE
 */
export function useImportGeneration(options: UseImportGenerationOptions = {}) {
  const { t } = useI18n()

  // Timer pour le temps d'exécution
  const {
    formatMs,
    formatStepDuration,
    formatCurrentStepDuration,
    formatSubStepDuration,
    currentElapsedTime,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer,
  } = useElapsedTimer()

  // Validation des URLs
  const { parseAndValidateUrls } = useUrlValidation()

  // État de génération
  const generating = ref(false)
  const generateError = ref('')
  const generationMethod = ref<GenerationMethod>('simple')
  // Recherche des services (caractéristiques de l'édition) via IA — activée par défaut
  const detectServices = ref(true)

  // État des providers IA
  const availableProviders = ref<AIProvider[]>([])
  const selectedProvider = ref<string | null>(null)
  const loadingProviders = ref(false)

  // État des étapes
  const currentStep = ref('')
  const stepHistory = ref<StepHistoryEntry[]>([])

  // État spécifique à l'agent
  const agentProgress = ref(0)
  const agentPagesVisited = ref(0)
  const agentResult = ref<GenerationResult | null>(null)

  /**
   * L'abandon se décide sur le SILENCE, pas sur la durée totale.
   *
   * Le serveur pingue toutes les dix secondes tant qu'il travaille : la preuve qu'il est vivant
   * existe en continu. Un plafond sur la durée totale ignorait ces pings, et aucune valeur ne
   * pouvait convenir — trop courte, elle coupait des analyses en bonne santé (l'extraction fait
   * désormais jusqu'à trois appels au modèle) ; trop longue, elle laissait l'utilisateur devant un
   * écran figé une demi-heure quand la connexion était réellement morte.
   *
   * Six pings manqués suffisent à conclure. Le plafond absolu ne sert plus que de dernier
   * recours, pour un serveur qui pinguerait sans jamais aboutir : il est donc large à dessein.
   * Une extraction interroge le modèle une fois par journée de convention — mesuré à 24 min 30 s
   * sur neuf jours avec un modèle local — et ce plafond ne doit jamais être ce qui l'arrête.
   */
  const SILENCE_PAR_DEFAUT = 60 * 1000
  const PLAFOND_ABSOLU_PAR_DEFAUT = 2 * 60 * 60 * 1000
  const configuredTimeout = Number(useRuntimeConfig().public.aiGenerationTimeout) || 0
  const defaultTimeout = options.timeout ?? (configuredTimeout || PLAFOND_ABSOLU_PAR_DEFAUT)
  const silenceTimeout = options.silenceTimeout ?? SILENCE_PAR_DEFAUT

  /**
   * Vérifie si l'index correspond à l'étape en cours
   */
  const isCurrentStep = (idx: number): boolean =>
    idx === stepHistory.value.length - 1 && currentStep.value !== 'completed'

  /**
   * Icône de l'étape en cours selon la méthode
   */
  const currentStepIcon = computed(() =>
    generationMethod.value === 'agent' ? 'i-heroicons-globe-alt' : 'i-heroicons-cog-6-tooth'
  )

  /**
   * Classe CSS de l'icône de l'étape en cours
   */
  const currentStepIconClass = computed(() =>
    generationMethod.value === 'agent'
      ? 'animate-pulse text-warning-500'
      : 'animate-spin text-warning-500'
  )

  /**
   * Wrapper pour formatStepDuration avec l'historique courant
   */
  const formatDuration = (entry: StepHistoryEntry, idx?: number): string => {
    return formatStepDuration(entry, idx ?? 0, stepHistory.value)
  }

  /**
   * Wrapper pour formatSubStepDuration
   */
  const formatSubStepWrapper = (
    parentEntry: StepHistoryEntry,
    subStep: SubStepEntry,
    subIdx: number
  ): string => {
    return formatSubStepDuration(parentEntry, subStep, subIdx)
  }

  /**
   * Récupère le label d'une étape depuis les traductions i18n
   */
  const getStepLabel = (step: string): string => {
    const key = `admin.import.steps.${step}`
    const translated = t(key)
    // Si la clé n'existe pas, t() retourne la clé elle-même
    return translated !== key ? translated : step
  }

  /**
   * Réinitialise l'état complet
   */
  const resetState = () => {
    generating.value = false
    generateError.value = ''
    currentStep.value = ''
    stepHistory.value = []
    agentResult.value = null
    agentProgress.value = 0
    agentPagesVisited.value = 0
    resetTimer()
  }

  /**
   * Charge les providers IA disponibles depuis l'API
   */
  const loadProviders = async (): Promise<void> => {
    if (loadingProviders.value) return

    loadingProviders.value = true
    try {
      const response = await $fetch<{ providers: AIProvider[]; defaultProvider: string | null }>(
        '/api/admin/ai-providers'
      )
      availableProviders.value = response.providers
      // Sélectionner le provider par défaut si aucun n'est sélectionné
      if (!selectedProvider.value && response.defaultProvider) {
        selectedProvider.value = response.defaultProvider
      }
    } catch (error) {
      console.error('[useImportGeneration] Erreur chargement providers:', error)
      availableProviders.value = []
    } finally {
      loadingProviders.value = false
    }
  }

  /**
   * Génère le JSON via SSE (Server-Sent Events)
   *
   * @param urls - Liste des URLs à traiter
   * @param method - Méthode de génération ('direct' ou 'agent')
   * @param previewedImageUrl - URL d'image prévisualisée (optionnel)
   * @param provider - Provider IA à utiliser (optionnel)
   */
  const generateWithSSE = (
    urls: string[],
    method: 'direct' | 'agent',
    previewedImageUrl?: string,
    provider?: string,
    detectServicesEnabled = true,
    programUrl?: string,
    perimetre?: {
      extractInfos?: boolean
      extractProgram?: boolean
      editionStartDate?: string
      editionEndDate?: string
      programDates?: string[]
    }
  ): Promise<GenerationResult> => {
    return new Promise((resolve, reject) => {
      const sseUrl = buildGenerationStreamUrl({
        method,
        urls,
        previewedImageUrl,
        provider,
        detectServices: detectServicesEnabled,
        programUrl,
        ...perimetre,
      })

      // withCredentials: true pour envoyer les cookies de session
      const eventSource = new EventSource(sseUrl, { withCredentials: true })
      let result: GenerationResult | null = null

      let minuterieSilence: ReturnType<typeof setTimeout> | null = null
      let minuteriePlafond: ReturnType<typeof setTimeout> | null = null

      const arreterMinuteries = () => {
        if (minuterieSilence) clearTimeout(minuterieSilence)
        if (minuteriePlafond) clearTimeout(minuteriePlafond)
        minuterieSilence = null
        minuteriePlafond = null
      }

      /** Abandonne, en rendant le résultat s'il était déjà arrivé. */
      const abandonner = (message: string) => {
        arreterMinuteries()
        if (eventSource.readyState === EventSource.CLOSED) return
        eventSource.close()
        if (result) {
          resolve(result)
        } else {
          options.onError?.(message)
          reject(new Error(message))
        }
      }

      // Réarmée à chaque événement reçu, ping compris.
      const relancerSilence = () => {
        if (minuterieSilence) clearTimeout(minuterieSilence)
        minuterieSilence = setTimeout(
          () => abandonner('Le serveur ne répond plus : connexion interrompue'),
          silenceTimeout
        )
      }
      relancerSilence()

      eventSource.onmessage = (event) => {
        // Avant même de lire le contenu : tout événement prouve que le serveur travaille.
        relancerSilence()
        try {
          const data = JSON.parse(event.data)
          if (import.meta.dev) {
            console.log('[SSE] Event received:', data.type)
          }

          switch (data.type) {
            case 'connected':
              if (import.meta.dev) {
                console.log(`[SSE] Connecté: method=${data.method}, urls=${data.urlCount}`)
              }
              break

            case 'ping':
              // Ping pour maintenir la connexion ouverte - ignorer silencieusement
              break

            case 'step': {
              // Mettre à jour l'étape en cours et ajouter à l'historique
              const label = data.label || getStepLabel(data.step)
              currentStep.value = data.step
              stepHistory.value.push({
                step: data.step,
                label,
                timestamp: new Date(),
              })
              options.onStepChange?.(data.step, label)
              break
            }

            case 'progress':
              // Mettre à jour la progression (spécifique à l'agent)
              if (method === 'agent') {
                agentPagesVisited.value = data.urlsVisited || 0
                agentProgress.value = Math.round((data.urlsVisited / data.maxUrls) * 100)
              }
              break

            case 'url_fetched': {
              if (import.meta.dev) {
                console.log(`[SSE] URL récupérée: ${data.currentUrl}`)
              }
              // Ajouter comme sous-étape de la dernière étape
              const lastStep = stepHistory.value[stepHistory.value.length - 1]
              if (lastStep) {
                if (!lastStep.subSteps) {
                  lastStep.subSteps = []
                }
                lastStep.subSteps.push({
                  url: data.currentUrl,
                  timestamp: new Date(),
                })
              }
              options.onUrlFetched?.(data.currentUrl)
              break
            }

            case 'result':
              result = {
                success: data.success,
                json: data.json,
                provider: data.provider,
                urlsProcessed: Array.isArray(data.urlsProcessed) ? data.urlsProcessed : undefined,
                iterations: data.iterations,
                programDayFailures: Array.isArray(data.programDayFailures)
                  ? data.programDayFailures
                  : undefined,
              }
              if (method === 'agent') {
                agentPagesVisited.value = Array.isArray(data.urlsProcessed)
                  ? data.urlsProcessed.length
                  : data.urlsProcessed || 0
              }
              options.onComplete?.(result)
              // Ne pas fermer ici, attendre que le serveur ferme
              break

            case 'error':
              arreterMinuteries()
              eventSource.close()
              options.onError?.(data.message || 'Erreur inconnue')
              reject(new Error(data.message || 'Erreur inconnue'))
              break
          }
        } catch (err) {
          console.error('[SSE] Erreur parsing:', err)
        }
      }

      eventSource.onerror = () => {
        arreterMinuteries()
        eventSource.close()
        // Si on a un résultat, c'est que la connexion s'est fermée normalement après le résultat
        if (result) {
          resolve(result)
        } else {
          const errorMsg = 'Connexion SSE perdue'
          options.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }
      }

      // Dernier recours : un serveur qui pinguerait sans jamais aboutir.
      minuteriePlafond = setTimeout(
        () => abandonner('Timeout: la génération a pris trop de temps'),
        defaultTimeout
      )
    })
  }

  /**
   * Lance la génération depuis les URLs
   *
   * @param urlsInput - Texte contenant les URLs (une par ligne ou séparées par virgules)
   * @param previewedImageUrl - URL d'image prévisualisée (optionnel)
   * @returns Le résultat de la génération ou null en cas d'erreur
   */
  const generate = async (
    urlsInput: string,
    previewedImageUrl?: string,
    programUrl?: string,
    perimetre?: {
      extractInfos?: boolean
      extractProgram?: boolean
      editionStartDate?: string
      editionEndDate?: string
      programDates?: string[]
    }
  ): Promise<GenerationResult | null> => {
    // Réinitialiser l'état
    generateError.value = ''
    currentStep.value = ''
    stepHistory.value = []
    agentResult.value = null
    agentProgress.value = 0
    agentPagesVisited.value = 0

    // Initialiser le timer
    resetTimer()
    startTimer()

    // Parser et valider les URLs
    const urlsResult = parseAndValidateUrls(urlsInput)
    if (!urlsResult.success) {
      generateError.value = urlsResult.error!
      stopTimer()
      return null
    }
    const urls = urlsResult.urls!

    try {
      generating.value = true

      // Utiliser SSE avec le provider sélectionné
      const method = generationMethod.value === 'agent' ? 'agent' : 'direct'
      const provider = selectedProvider.value || undefined
      const result = await generateWithSSE(
        urls,
        method,
        previewedImageUrl,
        provider,
        detectServices.value,
        programUrl,
        perimetre
      )

      if (generationMethod.value === 'agent') {
        agentResult.value = result
      }

      return result
    } catch (error: any) {
      generateError.value =
        error?.data?.message || error?.message || t('admin.import.generate_failed')
      return null
    } finally {
      generating.value = false
      stopTimer()
    }
  }

  return {
    // État
    generating,
    generateError,
    generationMethod,
    detectServices,
    currentStep,
    stepHistory,
    agentProgress,
    agentPagesVisited,
    agentResult,

    // Providers IA
    availableProviders,
    selectedProvider,
    loadingProviders,

    // Timer
    currentElapsedTime,
    formatMs,
    formatDuration,
    formatCurrentStepDuration,
    formatSubStepWrapper,

    // Helpers
    isCurrentStep,
    currentStepIcon,
    currentStepIconClass,
    getStepLabel,

    // Actions
    generate,
    resetState,
    loadProviders,
  }
}
