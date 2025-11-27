import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

// Timeout pour les requêtes HTTP (en ms)
const URL_FETCH_TIMEOUT = 15000 // 15 secondes par URL
const LLM_TIMEOUT = 120000 // 2 minutes pour le LLM

/**
 * Fetch avec timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Prompt système pour l'IA
const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction d'informations sur les conventions de jonglerie.
À partir des contenus de pages web fournis, tu dois extraire les informations et générer un JSON structuré.

Le JSON doit avoir exactement cette structure :
{
  "convention": {
    "name": "Nom de la convention (string, requis)",
    "email": "Email de contact (string email valide, requis)",
    "description": "Description de la convention (string, optionnel)"
  },
  "edition": {
    "name": "Nom de l'édition (string, optionnel - ex: 'CIJ 2025 - Paris')",
    "description": "Description de l'édition (string, optionnel)",
    "startDate": "Date et heure de début (requis) - format YYYY-MM-DDTHH:MM:SS si horaire trouvé, sinon YYYY-MM-DD",
    "endDate": "Date et heure de fin (requis) - format YYYY-MM-DDTHH:MM:SS si horaire trouvé, sinon YYYY-MM-DD",
    "timezone": "Fuseau horaire IANA (IMPORTANT - ex: 'Europe/Paris', 'Europe/Berlin', 'America/New_York')",
    "addressLine1": "Adresse principale (string, requis)",
    "addressLine2": "Complément d'adresse (string, optionnel)",
    "city": "Ville (string, requis)",
    "region": "Région (string, optionnel)",
    "country": "Pays (string, requis - ex: 'France')",
    "postalCode": "Code postal (string, requis)",
    "latitude": "Latitude GPS (number, optionnel)",
    "longitude": "Longitude GPS (number, optionnel)",
    "ticketingUrl": "URL de billetterie (string URL, optionnel)",
    "facebookUrl": "URL Facebook (string URL, optionnel)",
    "instagramUrl": "URL Instagram (string URL, optionnel)",
    "officialWebsiteUrl": "Site web officiel (string URL, optionnel)",
    "hasFoodTrucks": "Présence de food trucks (boolean, optionnel)",
    "hasKidsZone": "Espace enfants (boolean, optionnel)",
    "acceptsPets": "Animaux acceptés (boolean, optionnel)",
    "hasTentCamping": "Camping tente (boolean, optionnel)",
    "hasTruckCamping": "Camping véhicule (boolean, optionnel)",
    "hasGym": "Gymnase disponible (boolean, optionnel)",
    "hasCantine": "Cantine sur place (boolean, optionnel)",
    "hasShowers": "Douches disponibles (boolean, optionnel)",
    "hasToilets": "Toilettes disponibles (boolean, optionnel)",
    "hasWorkshops": "Ateliers proposés (boolean, optionnel)",
    "hasOpenStage": "Scène ouverte (boolean, optionnel)",
    "hasConcert": "Concerts (boolean, optionnel)",
    "hasGala": "Gala (boolean, optionnel)",
    "hasAccessibility": "Accessibilité PMR (boolean, optionnel)",
    "hasAerialSpace": "Espace aérien (boolean, optionnel)",
    "hasFamilyCamping": "Camping famille (boolean, optionnel)",
    "hasSleepingRoom": "Dortoir (boolean, optionnel)",
    "hasFireSpace": "Espace feu (boolean, optionnel)",
    "hasSlacklineSpace": "Espace slackline (boolean, optionnel)",
    "hasCashPayment": "Paiement espèces (boolean, optionnel)",
    "hasCreditCardPayment": "Paiement CB (boolean, optionnel)",
    "hasLongShow": "Spectacle long (boolean, optionnel)"
  }
}

RÈGLES IMPORTANTES:
1. DATES ET HORAIRES: Cherche activement les horaires d'ouverture et de fermeture de l'événement !
   - Si tu trouves des horaires (ex: "ouverture à 14h", "de 10h à 22h", "begins at 9am"), utilise le format YYYY-MM-DDTHH:MM:SS
   - Exemples: "2025-07-15T14:00:00" pour une ouverture à 14h, "2025-07-20T18:00:00" pour une fermeture à 18h
   - Si aucun horaire trouvé, utilise juste YYYY-MM-DD
2. TIMEZONE: TOUJOURS renseigner le fuseau horaire ! Déduis-le du pays/ville :
   - France -> "Europe/Paris"
   - Allemagne -> "Europe/Berlin"
   - UK/Angleterre -> "Europe/London"
   - Belgique -> "Europe/Brussels"
   - Suisse -> "Europe/Zurich"
   - Italie -> "Europe/Rome"
   - Espagne -> "Europe/Madrid"
   - Pays-Bas -> "Europe/Amsterdam"
   - USA côte Est -> "America/New_York"
   - USA côte Ouest -> "America/Los_Angeles"
   - Canada -> "America/Toronto" ou "America/Vancouver"
3. Si tu ne trouves pas une information requise, mets une valeur vide "" pour les strings ou invente une valeur plausible
4. Pour l'email, si tu ne le trouves pas, utilise "contact@" + le domaine du site
5. Les booléens sont tous optionnels, mets true seulement si l'information est clairement mentionnée
6. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après
7. N'ajoute pas de commentaires dans le JSON`

export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const { urls } = requestSchema.parse(body)

    // Récupérer le contenu des URLs avec timeout
    const contents: string[] = []
    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
          },
          URL_FETCH_TIMEOUT
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const html = await response.text()

        // Extraire le texte du HTML (simplification basique)
        const textContent = extractTextFromHtml(html, url)
        contents.push(`=== Contenu de ${url} ===\n${textContent}`)
      } catch (error: any) {
        const errorMsg =
          error.name === 'AbortError' ? `Timeout après ${URL_FETCH_TIMEOUT / 1000}s` : error.message
        contents.push(`=== Erreur pour ${url} ===\nImpossible de récupérer le contenu: ${errorMsg}`)
      }
    }

    const combinedContent = contents.join('\n\n')

    // Récupérer la configuration IA
    const config = useRuntimeConfig()
    const aiProvider = config.aiProvider || 'lmstudio'

    let generatedJson: string

    if (aiProvider === 'lmstudio') {
      // Utiliser le modèle texte (lmstudioTextModel) pour la génération JSON
      generatedJson = await callLMStudio(
        config.lmstudioBaseUrl || 'http://localhost:1234',
        config.lmstudioTextModel || config.lmstudioModel || 'auto',
        combinedContent
      )
    } else if (aiProvider === 'anthropic' && config.anthropicApiKey) {
      generatedJson = await callAnthropic(config.anthropicApiKey, combinedContent)
    } else if (aiProvider === 'ollama') {
      generatedJson = await callOllama(
        config.ollamaBaseUrl || 'http://localhost:11434',
        config.ollamaModel || 'llama3',
        combinedContent
      )
    } else {
      throw createError({
        statusCode: 500,
        message: `Provider IA non configuré ou non supporté: ${aiProvider}`,
      })
    }

    return {
      success: true,
      json: generatedJson,
      provider: aiProvider,
      urlsProcessed: urls.length,
    }
  },
  { operationName: 'GenerateImportJson' }
)

/**
 * Extrait le texte pertinent d'une page HTML
 */
function extractTextFromHtml(html: string, url: string): string {
  // Supprimer les scripts et styles
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')

  // Extraire le titre
  const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Extraire les meta descriptions
  const metaDescMatch = text.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  )
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : ''

  // Supprimer toutes les balises HTML
  text = text.replace(/<[^>]+>/g, ' ')

  // Décoder les entités HTML
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€')

  // Nettoyer les espaces multiples
  text = text.replace(/\s+/g, ' ').trim()

  // Limiter la longueur
  const maxLength = 8000
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...'
  }

  return `URL: ${url}\nTitre: ${title}\nDescription: ${metaDesc}\n\nContenu:\n${text}`
}

/**
 * Appel à LM Studio (API compatible OpenAI) avec timeout
 */
async function callLMStudio(baseUrl: string, model: string, content: string): Promise<string> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Voici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      },
      LLM_TIMEOUT
    )
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw createError({
        statusCode: 504,
        message: `Timeout LM Studio: le modèle n'a pas répondu dans les ${LLM_TIMEOUT / 1000} secondes. Essayez avec moins d'URLs ou un modèle plus rapide.`,
      })
    }
    throw createError({
      statusCode: 503,
      message: `Erreur de connexion à LM Studio: ${error.message}. Vérifiez que LM Studio est démarré.`,
    })
  }

  if (!response.ok) {
    const error = await response.text()
    throw createError({
      statusCode: 503,
      message: `Erreur LM Studio: ${error}. Vérifiez que LM Studio est démarré avec un modèle chargé.`,
    })
  }

  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || ''

  // Extraire le JSON de la réponse
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  // Valider que c'est un JSON valide
  try {
    JSON.parse(jsonMatch[0])
  } catch {
    throw createError({
      statusCode: 500,
      message: "Le JSON généré par l'IA n'est pas valide",
    })
  }

  return jsonMatch[0]
}

/**
 * Appel à l'API Anthropic
 */
async function callAnthropic(apiKey: string, content: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Voici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
      },
    ],
  })

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text)
    .join('')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  return jsonMatch[0]
}

/**
 * Appel à Ollama
 */
async function callOllama(baseUrl: string, model: string, content: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: `${SYSTEM_PROMPT}\n\nVoici le contenu des pages web d'une convention de jonglerie. Génère le JSON d'import:\n\n${content}`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw createError({
      statusCode: 503,
      message: `Erreur Ollama: ${response.statusText}`,
    })
  }

  const data = await response.json()
  const responseText = data.response || ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw createError({
      statusCode: 500,
      message: "L'IA n'a pas généré de JSON valide",
    })
  }

  return jsonMatch[0]
}
