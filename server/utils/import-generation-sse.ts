/**
 * Types et helpers SSE pour la génération d'import JSON
 * Utilisé par ED (Extraction Directe) et EI (Exploration Intelligente)
 */

/**
 * Types d'événements SSE pour la génération d'import
 */
export type ImportGenerationEventType =
  | 'connected'
  | 'step'
  | 'progress'
  | 'url_fetched'
  | 'result'
  | 'error'

/**
 * Étapes de génération (communes à ED et EI)
 */
export type GenerationStep =
  | 'starting'
  | 'scraping_facebook'
  | 'scraping_jugglingedge'
  | 'fetching_urls'
  | 'generating_json'
  | 'exploring_page' // EI uniquement
  | 'extracting_features'
  | 'completed'

/**
 * Labels des étapes pour l'affichage
 */
export const STEP_LABELS: Record<GenerationStep, string> = {
  starting: 'Démarrage...',
  scraping_facebook: 'Récupération des données Facebook...',
  scraping_jugglingedge: 'Récupération des données JugglingEdge...',
  fetching_urls: 'Récupération du contenu des URLs...',
  generating_json: 'Génération du JSON via IA...',
  exploring_page: 'Exploration des pages...',
  extracting_features: 'Détection des services...',
  completed: 'Terminé',
}

/**
 * Interface pour les événements SSE
 */
export interface ImportGenerationEvent {
  type: ImportGenerationEventType
  step?: GenerationStep
  label?: string
  // Pour le suivi de progression EI
  urlsVisited?: number
  maxUrls?: number
  currentUrl?: string
  // Pour le résultat final
  success?: boolean
  json?: string
  provider?: string
  urlsProcessed?: number
  // Pour les erreurs
  message?: string
  imageDownloaded?: boolean
  imageError?: string
}

/**
 * Type pour le callback de progression
 */
export type ProgressCallback = (event: ImportGenerationEvent) => void

/**
 * Crée un callback de progression qui envoie des événements SSE
 */
export function createSSEProgressCallback(push: (message: string) => void): ProgressCallback {
  return (event: ImportGenerationEvent) => {
    // Ajouter le label si c'est un événement de step sans label
    if (event.type === 'step' && event.step && !event.label) {
      event.label = STEP_LABELS[event.step]
    }
    push(JSON.stringify(event))
  }
}

/**
 * Envoie un événement de step
 */
export function sendStepEvent(callback: ProgressCallback, step: GenerationStep): void {
  callback({
    type: 'step',
    step,
    label: STEP_LABELS[step],
  })
}

/**
 * Envoie un événement de progression (EI)
 */
export function sendProgressEvent(
  callback: ProgressCallback,
  urlsVisited: number,
  maxUrls: number,
  currentUrl?: string
): void {
  callback({
    type: 'progress',
    urlsVisited,
    maxUrls,
    currentUrl,
  })
}

/**
 * Envoie un événement d'URL récupérée
 */
export function sendUrlFetchedEvent(callback: ProgressCallback, url: string): void {
  callback({
    type: 'url_fetched',
    currentUrl: url,
  })
}

/**
 * Envoie le résultat final
 */
export function sendResultEvent(
  callback: ProgressCallback,
  success: boolean,
  json: string,
  provider: string,
  urlsProcessed: number,
  imageDownloaded?: boolean,
  imageError?: string
): void {
  callback({
    type: 'result',
    success,
    json,
    provider,
    urlsProcessed,
    imageDownloaded,
    imageError,
  })
}

/**
 * Envoie une erreur
 */
export function sendErrorEvent(callback: ProgressCallback, message: string): void {
  callback({
    type: 'error',
    message,
  })
}
