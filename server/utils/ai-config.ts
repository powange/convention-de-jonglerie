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
      process.env.LMSTUDIO_BASE_URL ||
      process.env.NUXT_LMSTUDIO_BASE_URL ||
      config.lmstudioBaseUrl,
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
