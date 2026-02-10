/**
 * Composable pour la génération d'imports via SSE
 *
 * Encapsule la logique de génération de JSON depuis des URLs
 * avec support des méthodes "simple" et "agent".
 */

import type { StepHistoryEntry, SubStepEntry } from '~/composables/useElapsedTimer'

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
  /** Timeout de sécurité en ms (par défaut: 5 minutes) */
  timeout?: number
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
    formatSubStepDuration,
    currentElapsedTime,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer,
  } = useElapsedTimer()

  // Validation des URLs
  const { parseAndValidateUrls, getHostname } = useUrlValidation()

  // État de génération
  const generating = ref(false)
  const generateError = ref('')
  const generationMethod = ref<GenerationMethod>('simple')

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

  // Timeout par défaut: 5 minutes
  const defaultTimeout = options.timeout ?? 5 * 60 * 1000

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
    provider?: string
  ): Promise<GenerationResult> => {
    return new Promise((resolve, reject) => {
      const encodedUrls = urls.map((url) => encodeURIComponent(url)).join('\n')

      // Construire l'URL SSE avec les paramètres
      let sseUrl = `/api/admin/generate-import-json-stream?method=${method}&urls=${encodedUrls}`
      if (previewedImageUrl) {
        sseUrl += `&previewedImageUrl=${encodeURIComponent(previewedImageUrl)}`
      }
      if (provider) {
        sseUrl += `&provider=${encodeURIComponent(provider)}`
      }

      // withCredentials: true pour envoyer les cookies de session
      const eventSource = new EventSource(sseUrl, { withCredentials: true })
      let result: GenerationResult | null = null

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[SSE] Event received:', data.type)

          switch (data.type) {
            case 'connected':
              console.log(`[SSE] Connecté: method=${data.method}, urls=${data.urlCount}`)
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
              console.log(`[SSE] URL récupérée: ${data.currentUrl}`)
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
                urlsProcessed: data.urlsProcessed,
              }
              if (method === 'agent') {
                agentPagesVisited.value = data.urlsProcessed?.length || 0
              }
              options.onComplete?.(result)
              // Ne pas fermer ici, attendre que le serveur ferme
              break

            case 'error':
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

      // Timeout de sécurité
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close()
          if (result) {
            resolve(result)
          } else {
            const errorMsg = 'Timeout: la génération a pris trop de temps'
            options.onError?.(errorMsg)
            reject(new Error(errorMsg))
          }
        }
      }, defaultTimeout)
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
    previewedImageUrl?: string
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
      const result = await generateWithSSE(urls, method, previewedImageUrl, provider)

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
    formatSubStepWrapper,

    // Helpers
    isCurrentStep,
    currentStepIcon,
    currentStepIconClass,
    getHostname,
    getStepLabel,

    // Actions
    generate,
    resetState,
    loadProviders,
  }
}
