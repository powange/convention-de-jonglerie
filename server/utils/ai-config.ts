/**
 * Utilitaire pour récupérer la configuration IA effective
 *
 * Nuxt "bake" les variables d'env au build time dans useRuntimeConfig().
 * Pour permettre de configurer l'IA au runtime sans rebuild, on lit
 * process.env en priorité, puis les variables NUXT_*, puis le runtimeConfig.
 */

/**
 * Récupère la configuration IA effective en lisant process.env en priorité
 */
export function getEffectiveAIConfig() {
  const config = useRuntimeConfig()

  return {
    // Provider IA
    aiProvider: process.env.AI_PROVIDER || process.env.NUXT_AI_PROVIDER || config.aiProvider,

    // LM Studio
    lmstudioBaseUrl:
      process.env.LMSTUDIO_BASE_URL || process.env.NUXT_LMSTUDIO_BASE_URL || config.lmstudioBaseUrl,
    lmstudioModel:
      process.env.LMSTUDIO_MODEL || process.env.NUXT_LMSTUDIO_MODEL || config.lmstudioModel,
    lmstudioTextModel:
      process.env.LMSTUDIO_TEXT_MODEL ||
      process.env.NUXT_LMSTUDIO_TEXT_MODEL ||
      config.lmstudioTextModel,

    // Anthropic
    anthropicApiKey:
      process.env.ANTHROPIC_API_KEY || process.env.NUXT_ANTHROPIC_API_KEY || config.anthropicApiKey,

    // Ollama
    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL || process.env.NUXT_OLLAMA_BASE_URL || config.ollamaBaseUrl,
    ollamaModel: process.env.OLLAMA_MODEL || process.env.NUXT_OLLAMA_MODEL || config.ollamaModel,

    // Browserless
    browserlessUrl:
      process.env.BROWSERLESS_URL || process.env.NUXT_BROWSERLESS_URL || config.browserlessUrl,
  }
}

/**
 * Type de retour de getEffectiveAIConfig
 */
export type EffectiveAIConfig = ReturnType<typeof getEffectiveAIConfig>

/**
 * Cache pour le context length du modèle LM Studio
 * Évite de faire des requêtes répétées à l'API
 */
let cachedContextLength: number | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

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
  if (cachedContextLength !== null && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedContextLength
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout

    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[AI-CONFIG] Impossible de récupérer les modèles LM Studio: ${response.status}`)
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

      console.log(
        `[AI-CONFIG] Context length LM Studio détecté: ${contextLength} tokens (modèle: ${model.id})`
      )
      return contextLength
    }

    return DEFAULT_CONTEXT_LENGTHS.lmstudio
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[AI-CONFIG] Timeout lors de la récupération du context length LM Studio')
    } else {
      console.warn(`[AI-CONFIG] Erreur récupération context length: ${error.message}`)
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
    console.log(
      `[AI-CONFIG] Max content pour LM Studio: ${maxContent} caractères (context: ${contextLength})`
    )
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
