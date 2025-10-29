/**
 * Service abstrait pour gérer les différents providers d'IA (Anthropic, Ollama, etc.)
 */

import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedWorkshop {
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  maxParticipants?: number
  location?: string
}

export interface AIVisionResponse {
  workshops: ExtractedWorkshop[]
}

export interface AIProvider {
  name: string
  extractWorkshopsFromImage(
    imageBase64: string,
    imageType: string,
    prompt: string
  ): Promise<AIVisionResponse>
}

/**
 * Provider Anthropic Claude
 */
export class AnthropicProvider implements AIProvider {
  name = 'anthropic'
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async extractWorkshopsFromImage(
    imageBase64: string,
    imageType: string,
    prompt: string
  ): Promise<AIVisionResponse> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: `image/${imageType}` as any,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      })

      // Extraire le texte de la réponse
      const responseText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('')

      // Parser la réponse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Pas de JSON trouvé dans la réponse')
      }

      return JSON.parse(jsonMatch[0])
    } catch (error: any) {
      // Gérer les erreurs spécifiques de l'API Anthropic
      if (
        error.error?.type === 'invalid_request_error' &&
        error.error?.message?.includes('credit balance')
      ) {
        throw createError({
          statusCode: 503,
          message:
            "Le service d'extraction par IA (Anthropic) est temporairement indisponible (crédits insuffisants).",
        })
      }

      if (error.status === 401) {
        throw createError({
          statusCode: 503,
          message: "Le service d'extraction par IA (Anthropic) est mal configuré.",
        })
      }

      if (error.status === 429) {
        throw createError({
          statusCode: 429,
          message:
            "Trop de requêtes d'extraction (Anthropic). Veuillez réessayer dans quelques instants.",
        })
      }

      throw error
    }
  }
}

/**
 * Provider Ollama (local)
 */
export class OllamaProvider implements AIProvider {
  name = 'ollama'
  private baseUrl: string
  private model: string

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llava') {
    this.baseUrl = baseUrl
    this.model = model
  }

  async extractWorkshopsFromImage(
    imageBase64: string,
    imageType: string,
    prompt: string
  ): Promise<AIVisionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          images: [imageBase64],
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()
      const responseText = data.response

      // Parser la réponse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Pas de JSON trouvé dans la réponse')
      }

      return JSON.parse(jsonMatch[0])
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        throw createError({
          statusCode: 503,
          message:
            "Le service d'extraction par IA (Ollama) n'est pas accessible. Vérifiez qu'Ollama est démarré.",
        })
      }

      throw error
    }
  }
}

/**
 * Provider LM Studio (local, API compatible OpenAI)
 */
export class LMStudioProvider implements AIProvider {
  name = 'lmstudio'
  private baseUrl: string
  private model: string

  constructor(baseUrl: string = 'http://localhost:1234', model: string = 'auto') {
    this.baseUrl = baseUrl
    this.model = model
  }

  async extractWorkshopsFromImage(
    imageBase64: string,
    imageType: string,
    prompt: string
  ): Promise<AIVisionResponse> {
    console.log('[LM Studio] === Début de l\'extraction de workshops ===')

    try {
      const requestPayload = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${imageType};base64,${imageBase64.substring(0, 50)}...`, // Tronqué pour les logs
                },
              },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      }

      console.log('[LM Studio] Requête envoyée:')
      console.log('  URL:', `${this.baseUrl}/v1/chat/completions`)
      console.log('  Model:', this.model)
      console.log('  Prompt length:', prompt.length, 'caractères')
      console.log('  Image type:', imageType)
      console.log('  Image size:', imageBase64.length, 'caractères base64')
      console.log('  Temperature:', requestPayload.temperature)
      console.log('  Max tokens:', requestPayload.max_tokens)
      console.log('\n[LM Studio] Prompt complet:')
      console.log('--- DÉBUT DU PROMPT ---')
      console.log(prompt)
      console.log('--- FIN DU PROMPT ---\n')

      // LM Studio utilise l'API compatible OpenAI
      const startTime = Date.now()
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${imageType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 4096,
          stream: false,
        }),
      })
      const responseTime = Date.now() - startTime

      console.log('[LM Studio] Réponse reçue:')
      console.log('  Status:', response.status, response.statusText)
      console.log('  Response time:', responseTime, 'ms')

      if (!response.ok) {
        const errorData = await response.text()
        console.error('[LM Studio] Erreur API:', errorData)
        throw new Error(`LM Studio API error: ${response.statusText} - ${errorData}`)
      }

      const data = await response.json()
      console.log('[LM Studio] Données brutes:')
      console.log('  Choices:', data.choices?.length || 0)
      console.log('  Model:', data.model)
      console.log('  Usage:', data.usage)

      const responseText = data.choices[0]?.message?.content || ''
      console.log('[LM Studio] Contenu de la réponse:')
      console.log('  Length:', responseText.length, 'caractères')
      console.log('  Preview:', responseText)

      // Parser la réponse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[LM Studio] Pas de JSON trouvé dans la réponse complète:', responseText)
        throw new Error('Pas de JSON trouvé dans la réponse')
      }

      const parsedData = JSON.parse(jsonMatch[0])
      console.log('[LM Studio] JSON parsé avec succès:')
      console.log('  Workshops trouvés:', parsedData.workshops?.length || 0)
      console.log('[LM Studio] Détails des workshops:')
      console.log(JSON.stringify(parsedData.workshops, null, 2))

      return parsedData
    } catch (error: any) {
      console.error('[LM Studio] Erreur lors de l\'extraction:')
      console.error('  Error code:', error.code)
      console.error('  Error message:', error.message)
      console.error('  Error stack:', error.stack)

      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        console.error('[LM Studio] Service non accessible. Vérifiez que LM Studio est démarré.')
        throw createError({
          statusCode: 503,
          message:
            "Le service d'extraction par IA (LM Studio) n'est pas accessible. Vérifiez que LM Studio est démarré et qu'un modèle vision est chargé.",
        })
      }

      if (error.message?.includes('API error')) {
        console.error('[LM Studio] Erreur API:', error.message)
        throw createError({
          statusCode: 503,
          message: `Erreur LM Studio : ${error.message}. Assurez-vous qu'un modèle avec support vision (comme LLaVA) est chargé.`,
        })
      }

      console.error('[LM Studio] Erreur non gérée:', error)
      throw error
    }
  }
}

/**
 * Factory pour créer le provider approprié selon la configuration
 */
export function createAIProvider(config: {
  provider?: 'anthropic' | 'ollama' | 'lmstudio'
  anthropicApiKey?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
  lmstudioBaseUrl?: string
  lmstudioModel?: string
}): AIProvider {
  const provider = config.provider || 'anthropic'

  console.log('[AI Provider] Configuration du provider IA:', provider)
  console.log('[AI Provider] Config complète:', {
    provider,
    lmstudioBaseUrl: config.lmstudioBaseUrl,
    lmstudioModel: config.lmstudioModel,
  })

  switch (provider) {
    case 'anthropic':
      if (!config.anthropicApiKey) {
        throw createError({
          statusCode: 500,
          message: 'Clé API Anthropic non configurée',
        })
      }
      return new AnthropicProvider(config.anthropicApiKey)

    case 'ollama':
      return new OllamaProvider(config.ollamaBaseUrl, config.ollamaModel)

    case 'lmstudio':
      return new LMStudioProvider(config.lmstudioBaseUrl, config.lmstudioModel)

    default:
      throw createError({
        statusCode: 500,
        message: `Provider IA non supporté: ${provider}`,
      })
  }
}
