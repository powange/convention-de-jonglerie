/**
 * Schéma et prompt pour la génération de JSON d'import via IA
 * Utilisé par l'agent d'exploration (EI) et la génération directe (ED)
 */

import { EDITION_FEATURES_DESCRIPTIONS } from './edition-features-extractor'

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
  'region (Région/État/Province), timezone, imageUrl, ticketingUrl, facebookUrl, instagramUrl, latitude, longitude'

/**
 * Règles communes pour l'extraction (partagée ED/EI)
 */
export const COMMON_RULES_COMPACT = `- nom=événement (pas site source)
- email=seulement si explicitement trouvé (NE PAS INVENTER)
- timezone=DÉDUIS le timezone IANA du PAYS (France=Europe/Paris, Allemagne=Europe/Berlin, UK=Europe/London, Australie=Australia/Melbourne)
- dates avec heures si trouvées (YYYY-MM-DDTHH:MM:SS)`

/**
 * Génère la section des champs pour les prompts compacts
 */
export function generateFieldsSection(): string {
  return `CHAMPS OBLIGATOIRES: ${REQUIRED_FIELDS}
CHAMPS OPTIONNELS: ${OPTIONAL_FIELDS}`
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
  // Note: isOnline n'est pas inclus car une édition importée est toujours en ligne
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
      volunteersOpen: false,
      ...featuresObj,
    },
  })
}

/**
 * Génère le prompt système complet pour l'agent d'exploration
 * Version complète avec tous les champs
 */
export function generateAgentSystemPrompt(): string {
  return `Tu es un assistant spécialisé dans l'extraction d'informations sur les conventions de jonglerie.
Tu analyses des pages web pour extraire les données nécessaires à l'import d'une convention.

ACTIONS DISPONIBLES (une seule par réponse):
- FETCH_URL: <url> -> Explorer une page supplémentaire pour trouver plus d'informations
- GENERATE_JSON -> Générer le JSON final avec toutes les informations collectées

CHAMPS OBLIGATOIRES (le JSON doit contenir au minimum):
- convention.name: Nom de la convention
- convention.email: Email de contact (si non trouvé, utiliser contact@domaine-du-site.com)
- edition.startDate: Date de début (format YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)
- edition.endDate: Date de fin
- edition.addressLine1: Adresse
- edition.city: Ville
- edition.country: Pays
- edition.postalCode: Code postal

CHAMPS OPTIONNELS IMPORTANTS:
- edition.region: Région/État/Province (ex: Île-de-France, Victoria, California)
- edition.timezone: DÉDUIS le timezone IANA du PAYS de l'événement (France=Europe/Paris, Allemagne=Europe/Berlin, UK=Europe/London, Australie=Australia/Melbourne)
- edition.imageUrl: URL de l'affiche (chercher og:image ou images dans le contenu)
- edition.ticketingUrl: URL de la billetterie
- edition.facebookUrl, edition.instagramUrl, edition.officialWebsiteUrl
- edition.latitude, edition.longitude: Coordonnées GPS si disponibles
- edition.volunteersOpen: true si la convention cherche des bénévoles
- edition.volunteersExternalUrl: URL pour postuler comme bénévole

CARACTÉRISTIQUES À DÉTECTER (mettre true si mentionné dans le contenu):
${generateFeaturesDescription()}

STRUCTURE JSON ATTENDUE:
${generateJsonExample()}

RÈGLES IMPORTANTES:
1. PRIORITÉ FACEBOOK: Si un événement Facebook est fourni, ses données sont fiables (dates, lieu, image)
2. NAVIGATION: Utilise la navigation du site pour trouver les pages importantes (tarifs, infos pratiques, lieu, bénévoles)
3. Dates: Inclure l'heure si disponible (format YYYY-MM-DDTHH:MM:SS)
4. Timezone: TOUJOURS déduire le timezone IANA à partir du pays de l'événement, pas de la langue du site
5. Caractéristiques: Mets true uniquement si explicitement mentionné (camping, douches, spectacles, etc.)
6. Réponds UNIQUEMENT avec l'action choisie, sans explication

Quand tu génères le JSON, utilise GENERATE_JSON suivi du JSON complet.`
}

/**
 * Génère un prompt système compact pour ED (Extraction Directe)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export function generateCompactDirectPrompt(): string {
  return `Extrais les infos de convention de jonglerie en JSON.

${generateFieldsSection()}

RÈGLES:
${COMMON_RULES_COMPACT}

CARACTÉRISTIQUES (true si mentionné): ${generateCompactFeaturesDescription()}

FORMAT JSON:
${generateCompactJsonFormat()}

JSON seul, sans texte.`
}

/**
 * Génère un prompt système compact pour EI (Exploration Intelligente)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export function generateCompactAgentSystemPrompt(): string {
  return `Tu extrais des infos de conventions de jonglerie.

ACTIONS (une seule par réponse):
- FETCH_URL: <url> -> explorer une page
- GENERATE_JSON -> générer le JSON final

${generateFieldsSection()}

FORMAT JSON:
${generateCompactJsonFormat()}

CARACTÉRISTIQUES (true si mentionné): ${generateCompactFeaturesDescription()}

RÈGLES:
${COMMON_RULES_COMPACT}
- PRIORITÉ FACEBOOK: Si événement Facebook fourni, ses données priment
- Utilise la NAVIGATION du site pour trouver infos pratiques, tarifs, lieu
- Réponds UNIQUEMENT avec l'action`
}

/**
 * Génère le prompt de forçage de génération JSON
 */
export function generateForceGenerationPrompt(
  visitedUrls: string[],
  contentSummary: string
): string {
  return `ARRÊTE d'explorer des pages. Tu dois MAINTENANT générer le JSON final.

Résumé des ${visitedUrls.length} page(s) explorées:
${contentSummary}

INSTRUCTION FINALE:
Génère le JSON d'import avec la structure complète. Si une information obligatoire n'a pas été trouvée, utilise une valeur par défaut ou "".
Pour les caractéristiques (has...), mets true uniquement si explicitement mentionné.

Réponds UNIQUEMENT avec le JSON, sans FETCH_URL, sans GENERATE_JSON, juste le JSON:
{
  "convention": { "name": "...", "email": "...", "description": "..." },
  "edition": { "name": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", ... }
}`
}
