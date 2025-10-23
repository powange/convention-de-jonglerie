import Anthropic from '@anthropic-ai/sdk'

/**
 * Instance du client Anthropic
 * Utilise la clé API depuis les variables d'environnement
 */
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not defined in environment variables. Please add it to your .env file.'
      )
    }

    anthropicClient = new Anthropic({
      apiKey,
    })
  }

  return anthropicClient
}

/**
 * Modèles Claude disponibles
 */
export const CLAUDE_MODELS = {
  SONNET_4: 'claude-sonnet-4-20250514',
  SONNET_3_5: 'claude-3-5-sonnet-20241022',
  OPUS_3: 'claude-3-opus-20240229',
  SONNET_3: 'claude-3-sonnet-20240229',
  HAIKU_3: 'claude-3-haiku-20240307',
} as const

/**
 * Type pour les messages de conversation
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<ClaudeContentBlock>
}

/**
 * Types de contenu supportés
 */
export interface ClaudeContentBlock {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64' | 'url'
    media_type?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data?: string
    url?: string
  }
}

/**
 * Options pour les requêtes à Claude
 */
export interface ClaudeOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Envoie une requête texte simple à Claude
 *
 * @param prompt - Le message ou la question à envoyer à Claude
 * @param options - Options de configuration (modèle, tokens, température, etc.)
 * @returns La réponse texte de Claude
 *
 * @example
 * const response = await askClaude('Résume ce texte en 3 points', {
 *   model: CLAUDE_MODELS.SONNET_3_5,
 *   maxTokens: 500,
 * })
 */
export async function askClaude(prompt: string, options: ClaudeOptions = {}): Promise<string> {
  const anthropic = getAnthropicClient()

  const {
    model = CLAUDE_MODELS.SONNET_3_5,
    maxTokens = 1024,
    temperature = 1.0,
    systemPrompt,
  } = options

  const messageParams: Anthropic.Messages.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  }

  if (systemPrompt) {
    messageParams.system = systemPrompt
  }

  const message = await anthropic.messages.create(messageParams)

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return content.text
}

/**
 * Envoie une conversation multi-tours à Claude
 *
 * @param messages - Historique de la conversation
 * @param options - Options de configuration
 * @returns La réponse texte de Claude
 *
 * @example
 * const messages = [
 *   { role: 'user', content: 'Bonjour Claude' },
 *   { role: 'assistant', content: 'Bonjour ! Comment puis-je vous aider ?' },
 *   { role: 'user', content: 'Peux-tu m\'aider avec du code TypeScript ?' }
 * ]
 * const response = await conversationWithClaude(messages)
 */
export async function conversationWithClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<string> {
  const anthropic = getAnthropicClient()

  const {
    model = CLAUDE_MODELS.SONNET_3_5,
    maxTokens = 2048,
    temperature = 1.0,
    systemPrompt,
  } = options

  const messageParams: Anthropic.Messages.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages as Anthropic.Messages.MessageParam[],
  }

  if (systemPrompt) {
    messageParams.system = systemPrompt
  }

  const message = await anthropic.messages.create(messageParams)

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return content.text
}

/**
 * Analyse une image avec Claude (Vision)
 *
 * @param imageData - Données de l'image en base64 (sans le préfixe data:image/...)
 * @param prompt - Question ou instruction pour l'analyse de l'image
 * @param mediaType - Type MIME de l'image
 * @param options - Options de configuration
 * @returns La réponse texte de Claude après analyse
 *
 * @example
 * const imageBase64 = '...' // Image en base64
 * const analysis = await analyzeImage(
 *   imageBase64,
 *   'Décris ce que tu vois sur cette image',
 *   'image/jpeg'
 * )
 */
export async function analyzeImage(
  imageData: string,
  prompt: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
  options: ClaudeOptions = {}
): Promise<string> {
  const anthropic = getAnthropicClient()

  const {
    model = CLAUDE_MODELS.SONNET_3_5,
    maxTokens = 2048,
    temperature = 1.0,
    systemPrompt,
  } = options

  const messageParams: Anthropic.Messages.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  }

  if (systemPrompt) {
    messageParams.system = systemPrompt
  }

  const message = await anthropic.messages.create(messageParams)

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return content.text
}

/**
 * Analyse plusieurs images avec Claude (Vision)
 *
 * @param images - Tableau d'objets contenant les données d'image et leur type
 * @param prompt - Question ou instruction pour l'analyse des images
 * @param options - Options de configuration
 * @returns La réponse texte de Claude après analyse
 *
 * @example
 * const images = [
 *   { data: 'base64data1', mediaType: 'image/jpeg' },
 *   { data: 'base64data2', mediaType: 'image/png' }
 * ]
 * const analysis = await analyzeMultipleImages(
 *   images,
 *   'Compare ces deux images et liste les différences'
 * )
 */
export async function analyzeMultipleImages(
  images: Array<{
    data: string
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  }>,
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const anthropic = getAnthropicClient()

  const {
    model = CLAUDE_MODELS.SONNET_3_5,
    maxTokens = 4096,
    temperature = 1.0,
    systemPrompt,
  } = options

  const content: Anthropic.Messages.MessageParam['content'] = []

  // Ajouter toutes les images
  for (const image of images) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.data,
      },
    })
  }

  // Ajouter le prompt texte à la fin
  content.push({
    type: 'text',
    text: prompt,
  })

  const messageParams: Anthropic.Messages.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  }

  if (systemPrompt) {
    messageParams.system = systemPrompt
  }

  const message = await anthropic.messages.create(messageParams)

  const responseContent = message.content[0]
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return responseContent.text
}

/**
 * Extrait du texte depuis une image (OCR amélioré par IA)
 *
 * @param imageData - Données de l'image en base64
 * @param mediaType - Type MIME de l'image
 * @param options - Options de configuration
 * @returns Le texte extrait de l'image
 *
 * @example
 * const imageBase64 = '...'
 * const extractedText = await extractTextFromImage(imageBase64, 'image/jpeg')
 */
export async function extractTextFromImage(
  imageData: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
  options: ClaudeOptions = {}
): Promise<string> {
  return await analyzeImage(
    imageData,
    'Extrais tout le texte présent dans cette image. Retourne uniquement le texte extrait, sans commentaires additionnels.',
    mediaType,
    {
      ...options,
      systemPrompt:
        "Tu es un système OCR (reconnaissance optique de caractères). Ta tâche est d'extraire tout le texte visible dans les images de manière précise et structurée.",
    }
  )
}
