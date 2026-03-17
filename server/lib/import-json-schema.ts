/**
 * Schéma et prompt pour la génération de JSON d'import via IA
 * Utilisé par l'agent d'exploration (EI) et la génération directe (ED)
 *
 * Les textes des prompts sont dans server/prompts/*.txt
 * Ce fichier contient les données dynamiques (listes de features, format JSON)
 * et les fonctions qui assemblent les prompts finaux via loadPrompt().
 */

import { loadPrompt } from '#server/lib/prompt-loader'
import { EDITION_FEATURES_DESCRIPTIONS } from '#server/utils/edition-features-extractor'

// ============================================
// COMPOSANTS PARTAGÉS POUR LES PROMPTS ED/EI
// ============================================

/**
 * Liste des champs obligatoires (partagée ED/EI)
 */
export const REQUIRED_FIELDS =
  'name, email, startDate, endDate, addressLine1, city, country, postalCode'

/**
 * Liste des champs optionnels importants (partagée ED/EI)
 */
export const OPTIONAL_FIELDS =
  'region (Région/État/Province), timezone, imageUrl, ticketingUrl, facebookUrl, instagramUrl, jugglingEdgeUrl, latitude, longitude'

/**
 * Génère la section des champs pour les prompts compacts
 */
export function generateFieldsSection(): string {
  return `CHAMPS OBLIGATOIRES: ${REQUIRED_FIELDS}
CHAMPS OPTIONNELS: ${OPTIONAL_FIELDS}`
}

// ============================================
// PROMPT DE COMPLÉTION JSON PRÉ-REMPLI (ED/EI)
// ============================================

/**
 * Format JSON avec indications OBLIGATOIRE/optionnel pour l'IA
 */
export const JSON_FORMAT_FOR_COMPLETION = `{
  "convention": {
    "name": "OBLIGATOIRE - Nom de l'événement",
    "email": "OBLIGATOIRE - Email de contact",
    "description": "optionnel"
  },
  "edition": {
    "name": "optionnel",
    "description": "optionnel",
    "startDate": "OBLIGATOIRE - Format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS",
    "endDate": "OBLIGATOIRE - Format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS",
    "timezone": "OBLIGATOIRE - Format IANA (ex: Europe/Paris, Australia/Melbourne)",
    "addressLine1": "OBLIGATOIRE - Adresse",
    "addressLine2": "optionnel",
    "city": "OBLIGATOIRE",
    "region": "optionnel",
    "country": "OBLIGATOIRE",
    "postalCode": "OBLIGATOIRE",
    "latitude": "optionnel - number",
    "longitude": "optionnel - number",
    "ticketingUrl": "optionnel",
    "facebookUrl": "optionnel",
    "instagramUrl": "optionnel",
    "officialWebsiteUrl": "optionnel",
    "jugglingEdgeUrl": "optionnel - URL JugglingEdge si la source est jugglingedge.com",
    "imageUrl": "optionnel"
  }
}`

/**
 * Prompt pour compléter un JSON pré-rempli (Facebook + autres sources)
 * Utilisé par ED et EI quand des données Facebook sont disponibles
 */
export async function getPrefilledJsonPrompt(): Promise<string> {
  return loadPrompt('complete-prefilled', {
    JSON_FORMAT_FOR_COMPLETION,
  })
}

/**
 * Définition des champs du schéma d'import avec leurs descriptions
 * pour aider l'IA à comprendre ce qu'elle doit extraire
 */
export const IMPORT_SCHEMA_FIELDS = {
  convention: {
    name: { required: true, description: 'Nom de la convention/organisation' },
    email: { required: true, description: 'Email de contact principal' },
    description: { required: false, description: 'Description de la convention' },
  },
  edition: {
    // Informations de base
    name: { required: false, description: "Nom de l'édition (ex: 'Édition 2025')" },
    description: { required: false, description: "Description de l'édition" },
    startDate: { required: true, description: 'Date de début (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)' },
    endDate: { required: true, description: 'Date de fin (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)' },
    timezone: {
      required: false,
      description: 'Fuseau horaire IANA (ex: Europe/Paris, America/New_York)',
    },

    // Localisation
    addressLine1: { required: true, description: 'Adresse principale (rue, numéro)' },
    addressLine2: { required: false, description: "Complément d'adresse" },
    city: { required: true, description: 'Ville' },
    region: { required: false, description: 'Région/État/Province' },
    country: { required: true, description: 'Pays' },
    postalCode: { required: true, description: 'Code postal' },
    latitude: { required: false, description: 'Latitude GPS' },
    longitude: { required: false, description: 'Longitude GPS' },

    // URLs et liens
    imageUrl: { required: false, description: "URL de l'affiche/image principale" },
    ticketingUrl: { required: false, description: 'URL de la billetterie en ligne' },
    facebookUrl: { required: false, description: "URL de l'événement Facebook" },
    instagramUrl: { required: false, description: 'URL du compte Instagram' },
    officialWebsiteUrl: { required: false, description: 'URL du site officiel' },
    jugglingEdgeUrl: {
      required: false,
      description:
        "URL de l'événement sur JugglingEdge (https://www.jugglingedge.com/event.php?EventID=...)",
    },

    // Bénévolat
    volunteersOpen: {
      required: false,
      description: 'true si la convention recherche des bénévoles',
    },
    volunteersDescription: { required: false, description: 'Description du programme bénévole' },
    volunteersExternalUrl: {
      required: false,
      description: 'URL externe pour postuler comme bénévole',
    },
  },
} as const

/**
 * Génère l'exemple JSON complet pour le prompt IA
 */
export function generateJsonExample(): string {
  return JSON.stringify(
    {
      convention: {
        name: 'Nom de la convention',
        email: 'contact@example.com',
        description: 'Description optionnelle',
      },
      edition: {
        name: 'Édition 2025',
        description: "Description de l'édition",
        startDate: '2025-07-15',
        endDate: '2025-07-20',
        timezone: 'Europe/Paris',
        addressLine1: '123 Rue Example',
        addressLine2: '',
        city: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        postalCode: '75001',
        latitude: 48.8566,
        longitude: 2.3522,
        imageUrl: 'https://...',
        ticketingUrl: 'https://...',
        facebookUrl: 'https://facebook.com/events/...',
        instagramUrl: 'https://instagram.com/...',
        officialWebsiteUrl: 'https://...',
        jugglingEdgeUrl: 'https://www.jugglingedge.com/event.php?EventID=...',
        volunteersOpen: false,
        volunteersDescription: '',
        volunteersExternalUrl: '',
        // Caractéristiques (mettre true si mentionné)
        hasTentCamping: false,
        hasTruckCamping: false,
        hasFamilyCamping: false,
        hasSleepingRoom: false,
        hasFoodTrucks: false,
        hasCantine: false,
        hasGym: false,
        hasFireSpace: false,
        hasAerialSpace: false,
        hasSlacklineSpace: false,
        hasUnicycleSpace: false,
        hasWorkshops: false,
        hasKidsZone: false,
        hasGala: false,
        hasOpenStage: false,
        hasConcert: false,
        hasLongShow: false,
        hasToilets: false,
        hasShowers: false,
        hasAccessibility: false,
        acceptsPets: false,
        hasCashPayment: false,
        hasCreditCardPayment: false,
        hasAfjTokenPayment: false,
        hasATM: false,
      },
    },
    null,
    2
  )
}

/**
 * Génère la description des caractéristiques pour le prompt IA
 * Utilise les descriptions existantes de edition-features-extractor
 */
export function generateFeaturesDescription(): string {
  const lines: string[] = []
  for (const [key, desc] of Object.entries(EDITION_FEATURES_DESCRIPTIONS)) {
    lines.push(`- ${key}: ${desc}`)
  }
  return lines.join('\n')
}

/**
 * Liste des caractéristiques avec leurs labels pour le prompt compact
 * Centralisé ici pour être utilisé par ED et EI
 */
export const COMPACT_FEATURES_LIST = [
  { key: 'hasTentCamping', label: 'camping tente' },
  { key: 'hasTruckCamping', label: 'camping-car' },
  { key: 'hasFamilyCamping', label: 'camping famille' },
  { key: 'hasSleepingRoom', label: 'dortoir' },
  { key: 'hasFoodTrucks', label: 'food trucks' },
  { key: 'hasCantine', label: 'cantine' },
  { key: 'hasGym', label: 'gymnase' },
  { key: 'hasFireSpace', label: 'espace feu' },
  { key: 'hasAerialSpace', label: 'espace aérien/trapèze' },
  { key: 'hasSlacklineSpace', label: 'slackline' },
  { key: 'hasUnicycleSpace', label: 'espace monocycle' },
  { key: 'hasWorkshops', label: 'ateliers' },
  { key: 'hasKidsZone', label: 'zone enfants' },
  { key: 'hasGala', label: 'gala' },
  { key: 'hasOpenStage', label: 'scène ouverte' },
  { key: 'hasConcert', label: 'concert' },
  { key: 'hasLongShow', label: 'spectacle long' },
  { key: 'hasShowers', label: 'douches' },
  { key: 'hasToilets', label: 'WC' },
  { key: 'hasAccessibility', label: 'accessibilité PMR' },
  { key: 'acceptsPets', label: 'animaux acceptés' },
  { key: 'hasCashPayment', label: 'paiement espèces' },
  { key: 'hasCreditCardPayment', label: 'paiement CB' },
  { key: 'hasAfjTokenPayment', label: 'jetons AFJ' },
  { key: 'hasATM', label: 'distributeur' },
  // Note: status n'est pas inclus car une édition importée est toujours publiée (PUBLISHED)
] as const

/**
 * Génère la description compacte des caractéristiques pour les prompts à contexte limité
 * Format: "label (key), label (key), ..."
 */
export function generateCompactFeaturesDescription(): string {
  return COMPACT_FEATURES_LIST.map((f) => `${f.label} (${f.key})`).join(', ')
}

/**
 * Génère le JSON format compact avec tous les champs pour les prompts à contexte limité
 */
export function generateCompactJsonFormat(): string {
  const featuresObj: Record<string, boolean> = {}
  for (const f of COMPACT_FEATURES_LIST) {
    featuresObj[f.key] = false
  }

  return JSON.stringify({
    convention: { name: '', email: '', description: '' },
    edition: {
      name: '',
      description: '',
      startDate: 'YYYY-MM-DDTHH:MM:SS',
      endDate: 'YYYY-MM-DDTHH:MM:SS',
      timezone: 'Europe/Paris',
      addressLine1: '',
      city: '',
      region: '',
      country: '',
      postalCode: '',
      latitude: null,
      longitude: null,
      imageUrl: '',
      ticketingUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      officialWebsiteUrl: '',
      jugglingEdgeUrl: '',
      volunteersOpen: false,
      ...featuresObj,
    },
  })
}

/**
 * Génère le prompt système complet pour l'agent d'exploration
 * Version complète avec tous les champs
 */
export async function generateAgentSystemPrompt(): Promise<string> {
  return loadPrompt('agent-full', {
    FEATURES_DESCRIPTION: generateFeaturesDescription(),
    JSON_EXAMPLE: generateJsonExample(),
    RULES_FULL: await loadPrompt('rules-full'),
  })
}

/**
 * Génère un prompt système compact pour ED (Extraction Directe)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export async function generateCompactDirectPrompt(): Promise<string> {
  return loadPrompt('direct-compact', {
    FIELDS_SECTION: generateFieldsSection(),
    RULES_COMPACT: await loadPrompt('rules-compact'),
    COMPACT_FEATURES: generateCompactFeaturesDescription(),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}

/**
 * Génère un prompt système compact pour EI (Exploration Intelligente)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export async function generateCompactAgentSystemPrompt(): Promise<string> {
  return loadPrompt('agent-compact', {
    FIELDS_SECTION: generateFieldsSection(),
    RULES_COMPACT: await loadPrompt('rules-compact'),
    COMPACT_FEATURES: generateCompactFeaturesDescription(),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}

/**
 * Génère le prompt de forçage de génération JSON
 */
export async function generateForceGenerationPrompt(
  visitedUrls: string[],
  contentSummary: string
): Promise<string> {
  return loadPrompt('force-generation', {
    VISITED_COUNT: String(visitedUrls.length),
    CONTENT_SUMMARY: contentSummary,
    RULES_COMPACT: await loadPrompt('rules-compact'),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}
