import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { createTask, runTaskInBackground } from '@@/server/utils/async-tasks'
import { z } from 'zod'

const requestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
})

// Timeout pour les requêtes HTTP (en ms)
const URL_FETCH_TIMEOUT = 15000 // 15 secondes par URL
const LLM_TIMEOUT = 180000 // 3 minutes pour le LLM (modèles locaux peuvent être lents)

// Type pour le résultat de la génération
export interface GenerateImportResult {
  success: boolean
  json: string
  provider: string
  urlsProcessed: number
}

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

⚠️ CHAMPS OBLIGATOIRES (doivent TOUJOURS être présents et non vides) :
- convention.name : Nom de la convention (string)
- convention.email : Email de contact (string email valide)
- edition.startDate : Date de début (format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)
- edition.endDate : Date de fin (format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)
- edition.addressLine1 : Adresse principale (string)
- edition.city : Ville (string)
- edition.country : Pays (string, ex: "France")
- edition.postalCode : Code postal (string)

Le JSON doit avoir exactement cette structure :
{
  "convention": {
    "name": "OBLIGATOIRE - Nom de la convention",
    "email": "OBLIGATOIRE - Email de contact (format email valide)",
    "description": "optionnel - Description de la convention"
  },
  "edition": {
    "name": "optionnel - Nom de l'édition (ex: 'CIJ 2025 - Paris')",
    "description": "optionnel - Description de l'édition",
    "startDate": "OBLIGATOIRE - Date/heure début (YYYY-MM-DDTHH:MM:SS ou YYYY-MM-DD)",
    "endDate": "OBLIGATOIRE - Date/heure fin (YYYY-MM-DDTHH:MM:SS ou YYYY-MM-DD)",
    "timezone": "RECOMMANDÉ - Fuseau horaire IANA (ex: 'Europe/Paris')",
    "addressLine1": "OBLIGATOIRE - Adresse principale",
    "addressLine2": "optionnel - Complément d'adresse",
    "city": "OBLIGATOIRE - Ville",
    "region": "optionnel - Région/État",
    "country": "OBLIGATOIRE - Pays (ex: 'France')",
    "postalCode": "OBLIGATOIRE - Code postal",
    "latitude": "optionnel - Latitude GPS (number)",
    "longitude": "optionnel - Longitude GPS (number)",
    "ticketingUrl": "optionnel - URL de billetterie",
    "facebookUrl": "optionnel - URL page/événement Facebook",
    "instagramUrl": "optionnel - URL Instagram",
    "officialWebsiteUrl": "optionnel - Site web officiel",
    "imageUrl": "optionnel - URL de l'affiche/poster (image principale)",
    "hasFoodTrucks": "optionnel - boolean",
    "hasKidsZone": "optionnel - boolean",
    "acceptsPets": "optionnel - boolean",
    "hasTentCamping": "optionnel - boolean",
    "hasTruckCamping": "optionnel - boolean",
    "hasGym": "optionnel - boolean",
    "hasCantine": "optionnel - boolean",
    "hasShowers": "optionnel - boolean",
    "hasToilets": "optionnel - boolean",
    "hasWorkshops": "optionnel - boolean",
    "hasOpenStage": "optionnel - boolean",
    "hasConcert": "optionnel - boolean",
    "hasGala": "optionnel - boolean",
    "hasAccessibility": "optionnel - boolean",
    "hasAerialSpace": "optionnel - boolean",
    "hasFamilyCamping": "optionnel - boolean",
    "hasSleepingRoom": "optionnel - boolean",
    "hasFireSpace": "optionnel - boolean",
    "hasSlacklineSpace": "optionnel - boolean",
    "hasCashPayment": "optionnel - boolean",
    "hasCreditCardPayment": "optionnel - boolean",
    "hasLongShow": "optionnel - boolean"
  }
}

RÈGLES IMPORTANTES:

1. ÉVÉNEMENTS FACEBOOK (PRIORITÉ HAUTE):
   Si une URL facebook.com/events/ est fournie, c'est une SOURCE PRIORITAIRE ! Extrais en priorité :
   - Le titre de l'événement -> name de l'édition
   - La description complète de l'événement -> description de l'édition
   - Les dates et heures exactes (Facebook affiche toujours les horaires précis)
   - Le lieu avec adresse complète (Facebook structure bien l'adresse)
   - L'image de couverture de l'événement -> imageUrl
   - L'URL de l'événement Facebook -> facebookUrl
   - Les informations sur la billetterie si présentes -> ticketingUrl
   Facebook contient souvent des informations très structurées, utilise-les au maximum !

2. DATES ET HORAIRES: Cherche activement les horaires d'ouverture et de fermeture !
   - Facebook affiche les dates au format "Samedi 15 juillet 2025 de 14:00 à 22:00" -> extrais précisément
   - Si tu trouves des horaires, utilise le format YYYY-MM-DDTHH:MM:SS
   - Exemples: "2025-07-15T14:00:00" pour une ouverture à 14h
   - Si aucun horaire trouvé, utilise juste YYYY-MM-DD

3. TIMEZONE: TOUJOURS renseigner le fuseau horaire ! Déduis-le du pays/ville :
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

4. AFFICHE/POSTER: Cherche l'URL de l'affiche ou image principale !
   - Sur Facebook: l'image de couverture de l'événement (og:image)
   - Sur les sites: balises <img> avec classes "poster", "affiche", "banner", "hero"
   - Cherche les images Open Graph (og:image) ou Twitter Card
   - L'URL doit être complète (commencer par http:// ou https://)
   - Privilégie les grandes images (pas les icônes ou logos)

5. FUSION DES SOURCES: Si plusieurs URLs sont fournies, fusionne intelligemment les informations :
   - Facebook pour les dates/heures/lieu/description
   - Site officiel pour les détails (équipements, services, billetterie)
   - Privilégie les informations les plus complètes et précises

6. Si tu ne trouves pas une information requise, mets une valeur vide "" pour les strings
7. Pour l'email, si tu ne le trouves pas, utilise "contact@" + le domaine du site officiel
8. Les booléens sont tous optionnels, mets true seulement si l'information est clairement mentionnée
9. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après
10. N'ajoute pas de commentaires dans le JSON`

/**
 * Fonction de génération du JSON (exécutée en arrière-plan)
 */
export async function generateImportJson(urls: string[]): Promise<GenerateImportResult> {
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
  console.log(`[GENERATE-IMPORT] Contenu combiné: ${combinedContent.length} caractères`)

  // Récupérer la configuration IA
  const config = useRuntimeConfig()
  const aiProvider = config.aiProvider || 'lmstudio'
  console.log(`[GENERATE-IMPORT] Provider IA: ${aiProvider}`)

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
    throw new Error(`Provider IA non configuré ou non supporté: ${aiProvider}`)
  }

  return {
    success: true,
    json: generatedJson,
    provider: aiProvider,
    urlsProcessed: urls.length,
  }
}

/**
 * POST /api/admin/generate-import-json
 * Crée une tâche asynchrone et retourne immédiatement un taskId
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const { urls } = requestSchema.parse(body)

    // Créer une tâche asynchrone
    const task = createTask<GenerateImportResult>({ urls })

    console.log(`[GENERATE-IMPORT] Tâche créée: ${task.id} pour ${urls.length} URL(s)`)

    // Lancer la génération en arrière-plan
    runTaskInBackground(task.id, () => generateImportJson(urls))

    // Retourner immédiatement le taskId
    return {
      taskId: task.id,
      status: 'processing',
      message: 'Génération en cours...',
    }
  },
  { operationName: 'GenerateImportJson' }
)

/**
 * Extrait le texte pertinent d'une page HTML avec métadonnées enrichies
 */
function extractTextFromHtml(html: string, url: string): string {
  // Détecter si c'est une page Facebook
  const isFacebook = url.includes('facebook.com')

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

  // Extraire les métadonnées Open Graph (très importantes pour Facebook)
  const ogData: Record<string, string> = {}
  const ogMatches = html.matchAll(
    /<meta[^>]*property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi
  )
  for (const match of ogMatches) {
    ogData[match[1]] = match[2]
  }
  // Format alternatif (content avant property)
  const ogMatchesAlt = html.matchAll(
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](og:[^"']+)["'][^>]*>/gi
  )
  for (const match of ogMatchesAlt) {
    ogData[match[2]] = match[1]
  }

  // Construire la section métadonnées
  let metadata = `URL: ${url}\n`
  metadata += `Type: ${isFacebook ? 'Événement Facebook' : 'Site web'}\n`
  metadata += `Titre: ${title}\n`
  metadata += `Description: ${metaDesc}\n`

  // Ajouter les données Open Graph si présentes
  if (Object.keys(ogData).length > 0) {
    metadata += '\n=== Métadonnées Open Graph ===\n'
    if (ogData['og:title']) metadata += `og:title: ${ogData['og:title']}\n`
    if (ogData['og:description']) metadata += `og:description: ${ogData['og:description']}\n`
    if (ogData['og:image']) metadata += `og:image: ${ogData['og:image']}\n`
    if (ogData['og:url']) metadata += `og:url: ${ogData['og:url']}\n`
    if (ogData['og:site_name']) metadata += `og:site_name: ${ogData['og:site_name']}\n`
    // Données spécifiques aux événements
    if (ogData['og:type']) metadata += `og:type: ${ogData['og:type']}\n`
    // Autres données OG potentiellement utiles
    for (const [key, value] of Object.entries(ogData)) {
      if (
        !['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:type'].includes(
          key
        )
      ) {
        metadata += `${key}: ${value}\n`
      }
    }
  }

  // Extraire les données JSON-LD (souvent utilisées pour les événements)
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1])
      if (
        jsonLd['@type'] === 'Event' ||
        (Array.isArray(jsonLd['@graph']) &&
          jsonLd['@graph'].some((item: any) => item['@type'] === 'Event'))
      ) {
        metadata += '\n=== Données structurées Event (JSON-LD) ===\n'
        metadata += JSON.stringify(jsonLd, null, 2).substring(0, 2000) + '\n'
      }
    } catch {
      // Ignorer les erreurs de parsing JSON
    }
  }

  // Supprimer toutes les balises HTML pour le contenu textuel
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
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Nettoyer les espaces multiples
  text = text.replace(/\s+/g, ' ').trim()

  // Limiter la longueur du contenu textuel
  // Pour les modèles locaux (LM Studio), on limite davantage pour éviter les timeouts
  const maxContentLength = 4000
  if (text.length > maxContentLength) {
    text = text.substring(0, maxContentLength) + '...'
  }

  return `${metadata}\n=== Contenu textuel ===\n${text}`
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
 * Appel à l'API Anthropic avec timeout
 */
async function callAnthropic(apiKey: string, content: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey,
    timeout: LLM_TIMEOUT, // Timeout de 2 minutes
  })

  console.log('[GENERATE-IMPORT] Appel Anthropic en cours...')
  const startTime = Date.now()

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

  console.log(`[GENERATE-IMPORT] Réponse Anthropic reçue en ${Date.now() - startTime}ms`)

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
