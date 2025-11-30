/**
 * Utilitaire pour extraire les caractéristiques d'une édition depuis une description textuelle via IA
 */

/**
 * Description des caractéristiques pour guider l'IA
 */
export const EDITION_FEATURES_DESCRIPTIONS: Record<string, string> = {
  // Restauration
  hasFoodTrucks: 'Food trucks ou stands de nourriture sur place',
  hasCantine: 'Cantine ou repas organisés (petit-déjeuner, déjeuner, dîner inclus ou à acheter)',

  // Hébergement
  hasTentCamping: 'Camping en tente autorisé sur le site',
  hasTruckCamping: 'Camping en camion/van/camping-car autorisé',
  hasFamilyCamping: 'Zone de camping réservée aux familles (calme)',
  hasSleepingRoom: 'Dortoir ou salle de couchage intérieure disponible',

  // Espaces et activités
  hasGym: 'Gymnase ou salle couverte pour jongler',
  hasFireSpace: 'Espace dédié au feu/poi enflammés',
  hasAerialSpace: 'Espace pour les arts aériens (trapèze, cerceau, tissu)',
  hasSlacklineSpace: 'Espace slackline/funambule',
  hasWorkshops: 'Ateliers ou workshops programmés',

  // Spectacles
  hasGala: 'Gala ou spectacle de clôture',
  hasOpenStage: 'Scène ouverte (open stage) pour les participants',
  hasConcert: 'Concert ou soirée musicale',
  hasLongShow: 'Spectacles longs ou numéros de plus de 10 minutes',

  // Famille et accessibilité
  hasKidsZone: 'Espace enfants ou garderie',
  acceptsPets: 'Animaux de compagnie acceptés',
  hasAccessibility: 'Accessibilité PMR (personnes à mobilité réduite)',

  // Services
  hasToilets: 'Toilettes disponibles sur place',
  hasShowers: 'Douches disponibles',
  hasATM: 'Distributeur de billets sur place ou à proximité',

  // Paiement
  hasCashPayment: 'Paiement en espèces accepté',
  hasCreditCardPayment: 'Paiement par carte bancaire accepté',
  hasAfjTokenPayment: 'Paiement par jetons AFJ accepté',

  // Autres
  isOnline: 'Événement en ligne / virtuel (pas de lieu physique)',
}

/**
 * Type pour les caractéristiques d'une édition
 */
export interface EditionFeatures {
  hasFoodTrucks?: boolean
  hasKidsZone?: boolean
  acceptsPets?: boolean
  hasTentCamping?: boolean
  hasTruckCamping?: boolean
  hasGym?: boolean
  hasFamilyCamping?: boolean
  hasSleepingRoom?: boolean
  hasFireSpace?: boolean
  hasGala?: boolean
  hasOpenStage?: boolean
  hasConcert?: boolean
  hasCantine?: boolean
  hasAerialSpace?: boolean
  hasSlacklineSpace?: boolean
  hasToilets?: boolean
  hasShowers?: boolean
  hasAccessibility?: boolean
  hasWorkshops?: boolean
  hasCashPayment?: boolean
  hasCreditCardPayment?: boolean
  hasAfjTokenPayment?: boolean
  hasATM?: boolean
  hasLongShow?: boolean
  isOnline?: boolean
}

/**
 * Génère le prompt pour l'extraction des caractéristiques
 */
function buildFeaturesPrompt(): string {
  const featuresDescription = Object.entries(EDITION_FEATURES_DESCRIPTIONS)
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join('\n')

  return `Analyse la description de cette convention de jonglerie et détermine quelles caractéristiques sont présentes.

CARACTÉRISTIQUES À DÉTECTER:
${featuresDescription}

RÈGLES:
1. Réponds UNIQUEMENT avec un JSON contenant les caractéristiques détectées à true
2. N'inclus PAS les caractéristiques non mentionnées ou incertaines (elles seront false par défaut)
3. Sois conservateur : ne mets true que si c'est clairement indiqué dans le texte
4. Le JSON doit être valide, sans commentaires

EXEMPLE DE RÉPONSE:
{"hasGym": true, "hasTentCamping": true, "hasWorkshops": true, "hasCantine": true}`
}

/**
 * Extrait les caractéristiques d'une édition depuis une description via IA
 *
 * @param description - La description de l'événement (depuis Facebook ou autre)
 * @param aiProvider - Le provider IA à utiliser (lmstudio, anthropic, ollama)
 * @param config - La configuration runtime (pour les URLs/clés API)
 * @returns Les caractéristiques détectées
 */
export async function extractEditionFeatures(
  description: string,
  aiProvider: string,
  config: {
    lmstudioBaseUrl?: string
    lmstudioTextModel?: string
    lmstudioModel?: string
    anthropicApiKey?: string
    ollamaBaseUrl?: string
    ollamaModel?: string
  }
): Promise<EditionFeatures> {
  if (!description || description.trim().length < 50) {
    console.log("[FEATURES-EXTRACTOR] Description trop courte, pas d'extraction")
    return {}
  }

  const systemPrompt = buildFeaturesPrompt()
  const userPrompt = `DESCRIPTION DE L'ÉVÉNEMENT:\n${description.substring(0, 3000)}\n\nJSON des caractéristiques détectées:`

  console.log(`[FEATURES-EXTRACTOR] Extraction des caractéristiques via ${aiProvider}`)

  try {
    let responseText: string

    if (aiProvider === 'lmstudio') {
      responseText = await callLMStudioForFeatures(
        config.lmstudioBaseUrl || 'http://localhost:1234',
        config.lmstudioTextModel || config.lmstudioModel || 'auto',
        systemPrompt,
        userPrompt
      )
    } else if (aiProvider === 'anthropic' && config.anthropicApiKey) {
      responseText = await callAnthropicForFeatures(
        config.anthropicApiKey,
        systemPrompt,
        userPrompt
      )
    } else if (aiProvider === 'ollama') {
      responseText = await callOllamaForFeatures(
        config.ollamaBaseUrl || 'http://localhost:11434',
        config.ollamaModel || 'llama3',
        systemPrompt,
        userPrompt
      )
    } else {
      console.log(`[FEATURES-EXTRACTOR] Provider non supporté: ${aiProvider}`)
      return {}
    }

    // Parser le JSON de la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[FEATURES-EXTRACTOR] Pas de JSON dans la réponse')
      return {}
    }

    const features = JSON.parse(jsonMatch[0]) as EditionFeatures
    console.log('[FEATURES-EXTRACTOR] Caractéristiques extraites:', features)

    // Valider que les clés sont bien des caractéristiques connues
    const validFeatures: EditionFeatures = {}
    for (const [key, value] of Object.entries(features)) {
      if (key in EDITION_FEATURES_DESCRIPTIONS && typeof value === 'boolean') {
        ;(validFeatures as Record<string, boolean>)[key] = value
      }
    }

    return validFeatures
  } catch (error: any) {
    console.error(`[FEATURES-EXTRACTOR] Erreur: ${error.message}`)
    return {}
  }
}

/**
 * Appel LM Studio pour l'extraction des caractéristiques
 */
async function callLMStudioForFeatures(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Très bas pour des réponses cohérentes
      max_tokens: 512,
    }),
  })

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Appel Anthropic pour l'extraction des caractéristiques
 */
async function callAnthropicForFeatures(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: 30000 })

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
}

/**
 * Appel Ollama pour l'extraction des caractéristiques
 */
async function callOllamaForFeatures(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`)
  }

  const data = await response.json()
  return data.response || ''
}

/**
 * Fusionne les caractéristiques extraites avec un objet JSON existant
 */
export function mergeFeaturesIntoJson<T extends { edition?: Partial<EditionFeatures> }>(
  json: T,
  features: EditionFeatures
): T {
  if (!json.edition) {
    return json
  }

  return {
    ...json,
    edition: {
      ...json.edition,
      ...features,
    },
  }
}
