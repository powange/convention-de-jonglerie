import { loggers } from './logger'

const log = loggers.aiConfig

/**
 * Utilitaire pour récupérer la configuration IA effective
 *
 * Nuxt "bake" les variables d'env au build time dans useRuntimeConfig().
 * Pour permettre de configurer l'IA au runtime sans rebuild, on lit
 * process.env en priorité, puis les variables NUXT_*, puis le runtimeConfig.
 */

/**
 * Timeouts centralisés (en millisecondes)
 * Configurables via variables d'environnement
 */
export const AI_TIMEOUTS = {
  /** Timeout pour les requêtes HTTP de fetch d'URLs (par défaut: 15s) */
  URL_FETCH: parseInt(process.env.AI_TIMEOUT_URL_FETCH || '15000', 10),

  /** Timeout pour les appels LLM (par défaut: 3 minutes) */
  LLM_REQUEST: parseInt(process.env.AI_TIMEOUT_LLM || '180000', 10),

  /** Timeout pour la détection du context length LM Studio (par défaut: 3s) */
  CONTEXT_LENGTH_DETECTION: parseInt(process.env.AI_TIMEOUT_CONTEXT_DETECTION || '3000', 10),

  /** Timeout SSE côté client (par défaut: 5 minutes) */
  SSE_CLIENT: parseInt(process.env.AI_TIMEOUT_SSE || '300000', 10),

  /** Durée du cache du context length (par défaut: 5 minutes) */
  CONTEXT_LENGTH_CACHE: parseInt(process.env.AI_CACHE_CONTEXT_LENGTH || '300000', 10),

  /** Durée du cache du contenu web (par défaut: 5 minutes) */
  WEB_CONTENT_CACHE: parseInt(process.env.AI_CACHE_WEB_CONTENT || '300000', 10),
} as const

/**
 * Limites pour l'agent d'exploration
 */
export const AGENT_LIMITS = {
  /** Nombre maximum de pages à explorer */
  MAX_ITERATIONS: parseInt(process.env.AI_AGENT_MAX_ITERATIONS || '4', 10),

  /** Taille maximale par page (caractères, par défaut) */
  DEFAULT_MAX_PAGE_CONTENT_SIZE: 2500,

  /** Taille maximale totale du contenu (caractères, par défaut) */
  DEFAULT_MAX_TOTAL_CONTENT_SIZE: 10000,
} as const

/**
 * Type de la config IA en BDD
 */
interface DbAiConfig {
  id: string
  provider: string
  lmstudioBaseUrl: string
  lmstudioModelId: string | null
  lmstudioTextModelId: string | null
  anthropicApiKey: string | null
  ollamaBaseUrl: string
  ollamaModel: string
}

/**
 * Cache mémoire pour la config IA depuis la BDD
 * Évite les requêtes Prisma répétées lors des explorations multi-pages
 */
let cachedDbConfig: DbAiConfig | null | undefined = undefined
let dbConfigCacheTimestamp: number = 0
const DB_CONFIG_CACHE_TTL = 30_000 // 30 secondes

/**
 * Récupère la configuration IA depuis la BDD (crée l'entrée par défaut si absente)
 */
export async function getEffectiveAIConfigAsync() {
  const now = Date.now()
  let dbConfig = cachedDbConfig

  if (
    dbConfig === undefined ||
    dbConfig === null ||
    now - dbConfigCacheTimestamp > DB_CONFIG_CACHE_TTL
  ) {
    dbConfig = await prisma.aiConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    })
    cachedDbConfig = dbConfig
    dbConfigCacheTimestamp = now
  }

  const config = useRuntimeConfig()

  return {
    aiProvider: dbConfig.provider,
    lmstudioBaseUrl: dbConfig.lmstudioBaseUrl,
    lmstudioModel: dbConfig.lmstudioModelId,
    lmstudioTextModel: dbConfig.lmstudioTextModelId,
    anthropicApiKey: dbConfig.anthropicApiKey,
    ollamaBaseUrl: dbConfig.ollamaBaseUrl,
    ollamaModel: dbConfig.ollamaModel,
    browserlessUrl:
      process.env.BROWSERLESS_URL || process.env.NUXT_BROWSERLESS_URL || config.browserlessUrl,
  }
}

/**
 * Invalide le cache de la config IA en BDD (à appeler après modification)
 */
export function invalidateDbConfigCache(): void {
  cachedDbConfig = undefined
  dbConfigCacheTimestamp = 0
}

/**
 * Type de retour de getEffectiveAIConfigAsync
 */
export type EffectiveAIConfig = Awaited<ReturnType<typeof getEffectiveAIConfigAsync>>

/**
 * Sérialise la config IA pour l'API (masque la clé API Anthropic)
 */
export function serializeAiConfig(config: {
  provider: string
  lmstudioBaseUrl: string
  lmstudioModelId: string | null
  lmstudioTextModelId: string | null
  anthropicApiKey: string | null
  ollamaBaseUrl: string
  ollamaModel: string
}) {
  return {
    provider: config.provider,
    lmstudioBaseUrl: config.lmstudioBaseUrl,
    lmstudioModelId: config.lmstudioModelId,
    lmstudioTextModelId: config.lmstudioTextModelId,
    anthropicApiKey: config.anthropicApiKey ? '****' : null,
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
  }
}

/**
 * Cache pour le context length du modèle LM Studio
 * Évite de faire des requêtes répétées à l'API
 */
let cachedContextLength: number | null = null
let cacheTimestamp: number = 0

/**
 * Valeurs par défaut de context length selon le provider
 */
const DEFAULT_CONTEXT_LENGTHS: Record<string, number> = {
  lmstudio: 4096, // Valeur conservative pour modèles locaux
  ollama: 4096,
  anthropic: 200000, // Claude a un très grand contexte
}

/**
 * Récupère le context length du modèle LM Studio via l'API /v1/models
 * Retourne la valeur en cache si disponible et récente
 */
export async function getLMStudioContextLength(baseUrl: string): Promise<number> {
  const now = Date.now()

  // Utiliser le cache si disponible et récent
  if (cachedContextLength !== null && now - cacheTimestamp < AI_TIMEOUTS.CONTEXT_LENGTH_CACHE) {
    return cachedContextLength
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUTS.CONTEXT_LENGTH_DETECTION)

    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      log.warn(`Impossible de récupérer les modèles LM Studio: ${response.status}`)
      return DEFAULT_CONTEXT_LENGTHS.lmstudio
    }

    const data = await response.json()

    // LM Studio retourne { data: [{ id: "...", context_length: 8192, ... }] }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const model = data.data[0]
      const contextLength =
        model.context_length || model.max_tokens || DEFAULT_CONTEXT_LENGTHS.lmstudio

      // Mettre en cache
      cachedContextLength = contextLength
      cacheTimestamp = now

      log.info(`Context length LM Studio détecté: ${contextLength} tokens (modèle: ${model.id})`)
      return contextLength
    }

    return DEFAULT_CONTEXT_LENGTHS.lmstudio
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log.warn('Timeout lors de la récupération du context length LM Studio')
    } else {
      log.warn(`Erreur récupération context length: ${error.message}`)
    }
    return DEFAULT_CONTEXT_LENGTHS.lmstudio
  }
}

/**
 * Calcule la taille maximale de contenu à envoyer à l'IA
 * basée sur le context length du modèle
 *
 * Règle: on réserve ~1500 tokens pour le prompt système et la réponse
 * et on utilise ~60% du reste pour le contenu (1 token ≈ 4 caractères en français)
 */
export function calculateMaxContentSize(contextLength: number): number {
  const reservedTokens = 1500 // Pour prompt système + réponse
  const availableTokens = contextLength - reservedTokens
  const contentTokens = Math.floor(availableTokens * 0.6)
  const maxChars = contentTokens * 4 // ~4 caractères par token en français

  // Bornes min/max raisonnables
  return Math.max(1500, Math.min(maxChars, 50000))
}

/**
 * Récupère la taille maximale de contenu pour le provider IA configuré
 */
export async function getMaxContentSizeForProvider(
  provider: string,
  lmstudioBaseUrl?: string
): Promise<number> {
  if (provider === 'lmstudio' && lmstudioBaseUrl) {
    const contextLength = await getLMStudioContextLength(lmstudioBaseUrl)
    const maxContent = calculateMaxContentSize(contextLength)
    log.info(`Max content pour LM Studio: ${maxContent} caractères (context: ${contextLength})`)
    return maxContent
  }

  if (provider === 'anthropic') {
    // Anthropic a un très grand contexte, on peut être généreux
    return calculateMaxContentSize(DEFAULT_CONTEXT_LENGTHS.anthropic)
  }

  if (provider === 'ollama') {
    // Ollama: utiliser la valeur par défaut conservative
    return calculateMaxContentSize(DEFAULT_CONTEXT_LENGTHS.ollama)
  }

  // Valeur par défaut conservative
  return 2000
}

/**
 * Invalide le cache du context length (utile si le modèle change)
 */
export function invalidateContextLengthCache(): void {
  cachedContextLength = null
  cacheTimestamp = 0
}
