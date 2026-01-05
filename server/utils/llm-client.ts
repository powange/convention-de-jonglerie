/**
 * Client LLM unifié pour tous les providers IA
 *
 * Centralise les appels LLM vers LM Studio, Anthropic et Ollama
 * avec une interface commune.
 */

import { AI_TIMEOUTS } from './ai-config'
import { fetchWithTimeout } from './fetch-helpers'
import { loggers } from './logger'

const log = loggers.llm

/**
 * Types de messages pour la conversation
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Options pour un appel LLM
 */
export interface LLMCallOptions {
  /** Temperature pour la génération (0-1) */
  temperature?: number
  /** Nombre maximum de tokens à générer */
  maxTokens?: number
  /** Timeout personnalisé en ms */
  timeout?: number
}

/**
 * Résultat d'un appel LLM
 */
export interface LLMResult {
  /** Texte généré */
  text: string
  /** Provider utilisé */
  provider: string
  /** Nombre de tokens utilisés (si disponible) */
  tokensUsed?: number
}

/**
 * Configuration minimale pour un appel LLM
 */
export interface LLMConfig {
  aiProvider: string
  lmstudioBaseUrl?: string
  lmstudioModel?: string
  lmstudioTextModel?: string
  anthropicApiKey?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
}

/**
 * Appelle LM Studio via l'API OpenAI-compatible
 */
async function callLMStudio(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  options: LLMCallOptions
): Promise<LLMResult> {
  const baseUrl = config.lmstudioBaseUrl || 'http://localhost:1234'
  const model = config.lmstudioTextModel || config.lmstudioModel || 'auto'
  const timeout = options.timeout || AI_TIMEOUTS.LLM_REQUEST

  log.debug(`Appel LM Studio: ${baseUrl}, modèle: ${model}`)

  const response = await fetchWithTimeout(
    `${baseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
      }),
    },
    timeout
  )

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''

  log.debug(`Réponse LM Studio: ${text.length} caractères`)

  return {
    text,
    provider: 'lmstudio',
    tokensUsed: data.usage?.total_tokens,
  }
}

/**
 * Appelle Anthropic via le SDK officiel
 */
async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  options: LLMCallOptions
): Promise<LLMResult> {
  if (!config.anthropicApiKey) {
    throw new Error(
      "Provider 'anthropic' configuré mais ANTHROPIC_API_KEY manquante. Vérifiez votre .env ou utilisez AI_PROVIDER=lmstudio"
    )
  }

  log.debug('Appel Anthropic Claude')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    timeout: options.timeout || AI_TIMEOUTS.LLM_REQUEST,
  })

  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: options.maxTokens ?? 4096,
    system: systemPrompt,
    messages: anthropicMessages,
  })

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  log.debug(`Réponse Anthropic: ${text.length} caractères`)

  return {
    text,
    provider: 'anthropic',
    tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
  }
}

/**
 * Appelle Ollama via l'API REST
 */
async function callOllama(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  options: LLMCallOptions
): Promise<LLMResult> {
  const baseUrl = config.ollamaBaseUrl || 'http://localhost:11434'
  const model = config.ollamaModel || 'llama3'
  const timeout = options.timeout || AI_TIMEOUTS.LLM_REQUEST

  log.debug(`Appel Ollama: ${baseUrl}, modèle: ${model}`)

  // Construire le prompt complet pour Ollama
  const fullPrompt = `${systemPrompt}\n\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}`

  const response = await fetchWithTimeout(
    `${baseUrl}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.3,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
    },
    timeout
  )

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.response || ''

  log.debug(`Réponse Ollama: ${text.length} caractères`)

  return {
    text,
    provider: 'ollama',
    tokensUsed: data.eval_count,
  }
}

/**
 * Appelle le LLM configuré avec le système de chat
 *
 * @param config - Configuration IA (provider, URLs, clés API)
 * @param systemPrompt - Prompt système
 * @param messages - Messages de la conversation
 * @param options - Options d'appel (temperature, maxTokens, timeout)
 *
 * @example
 * const result = await callLLM(
 *   getEffectiveAIConfig(),
 *   'Tu es un assistant qui extrait des informations...',
 *   [{ role: 'user', content: 'Voici le contenu...' }],
 *   { temperature: 0.3 }
 * )
 */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  options: LLMCallOptions = {}
): Promise<LLMResult> {
  const provider = config.aiProvider || 'lmstudio'

  log.info(`Appel LLM via provider: ${provider}`)

  switch (provider) {
    case 'lmstudio':
      return callLMStudio(config, systemPrompt, messages, options)

    case 'anthropic':
      return callAnthropic(config, systemPrompt, messages, options)

    case 'ollama':
      return callOllama(config, systemPrompt, messages, options)

    default:
      throw new Error(
        `Provider IA non supporté: ${provider}. Providers valides: lmstudio, anthropic, ollama`
      )
  }
}

/**
 * Appelle le LLM avec un prompt simple (sans historique de conversation)
 *
 * @param config - Configuration IA
 * @param systemPrompt - Prompt système
 * @param userPrompt - Prompt utilisateur
 * @param options - Options d'appel
 *
 * @example
 * const result = await callLLMSimple(
 *   getEffectiveAIConfig(),
 *   'Tu extrais des caractéristiques depuis une description...',
 *   'Description de l\'événement: ...'
 * )
 */
export async function callLLMSimple(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
  options: LLMCallOptions = {}
): Promise<LLMResult> {
  return callLLM(config, systemPrompt, [{ role: 'user', content: userPrompt }], options)
}

/**
 * Nettoie et parse un JSON potentiellement mal formaté
 */
export function cleanAndParseJson(jsonString: string): string | null {
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
    log.debug('JSON nettoyé avec succès')
    return cleaned
  } catch (error) {
    log.warn('Impossible de parser le JSON même après nettoyage', error)

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
        log.debug('JSON extrait avec succès')
        return extractedJson
      }
    } catch {
      // Abandon
    }
  }

  return null
}

/**
 * Extrait un JSON depuis la réponse du LLM
 */
export function extractJsonFromResponse(responseText: string): string | null {
  // Chercher un JSON avec la structure attendue
  const jsonMatch = responseText.match(/\{[\s\S]*"convention"[\s\S]*"edition"[\s\S]*\}/)
  if (jsonMatch) {
    return cleanAndParseJson(jsonMatch[0])
  }

  // Chercher un bloc de code JSON
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return cleanAndParseJson(codeBlockMatch[1].trim())
  }

  return null
}
