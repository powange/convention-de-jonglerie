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
 * Factory pour créer le provider approprié selon la configuration
 */
export function createAIProvider(config: {
  provider?: 'anthropic' | 'ollama'
  anthropicApiKey?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
}): AIProvider {
  const provider = config.provider || 'anthropic'

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

    default:
      throw createError({
        statusCode: 500,
        message: `Provider IA non supporté: ${provider}`,
      })
  }
}
