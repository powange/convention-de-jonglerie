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
 * Règles communes pour l'extraction (partagée ED/EI) - VERSION COMPLÈTE
 */
export const COMMON_RULES_FULL = `1. NOM: Le nom doit être celui de L'ÉVÉNEMENT/CONVENTION, pas du site source
2. EMAIL: UNIQUEMENT si explicitement trouvé dans les sources (NE PAS INVENTER, ne pas deviner). Si non trouvé, laisser ""
3. URLs (ticketingUrl, instagramUrl, imageUrl, etc.): COPIER EXACTEMENT l'URL trouvée dans les sources, caractère par caractère, sans modifier un seul caractère. NE JAMAIS INVENTER d'URL. Si non trouvée, laisser ""
4. IMAGE URL: Si og:image est fourni, COPIER L'URL EXACTE sans aucune modification. Les URLs Google (lh3.googleusercontent.com) contiennent des identifiants uniques - ne pas les modifier.
5. TIMEZONE: TOUJOURS déduire le timezone IANA à partir du PAYS de l'événement (France=Europe/Paris, Allemagne=Europe/Berlin, UK=Europe/London, Australie=Australia/Melbourne)
6. DATES: Inclure l'heure si disponible (format YYYY-MM-DDTHH:MM:SS)
7. CARACTÉRISTIQUES: Mets true UNIQUEMENT si explicitement mentionné dans le contenu (camping, douches, spectacles, etc.)
8. PRIORITÉ FACEBOOK/JUGGLINGEDGE: Si des données structurées sont fournies (Facebook, JugglingEdge JSON-LD), elles sont fiables et prioritaires`

/**
 * Règles communes pour l'extraction (partagée ED/EI) - VERSION COMPACTE
 */
export const COMMON_RULES_COMPACT = `- nom=événement (pas site source)
- email=seulement si explicitement trouvé (NE PAS INVENTER), sinon ""
- URLs=COPIER EXACTEMENT caractère par caractère (imageUrl, ticketingUrl...), JAMAIS INVENTER
- imageUrl=COPIER l'URL og:image EXACTE (ne pas modifier les URLs Google)
- timezone=DÉDUIS du PAYS (France=Europe/Paris, Allemagne=Europe/Berlin, UK=Europe/London, Australie=Australia/Melbourne)
- dates avec heures si trouvées (YYYY-MM-DDTHH:MM:SS)
- caractéristiques=true seulement si explicitement mentionné
- PRIORITÉ données structurées (Facebook, JugglingEdge JSON-LD)`

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
    "imageUrl": "optionnel"
  }
}`

/**
 * Prompt pour compléter un JSON pré-rempli (Facebook + autres sources)
 * Utilisé par ED et EI quand des données Facebook sont disponibles
 */
export const PROMPT_COMPLETE_PREFILLED_JSON = `Tu dois compléter un JSON pré-rempli avec les informations des sources fournies.

CHAMPS PRIORITAIRES À REMPLIR:
- convention.name : Le nom de la CONVENTION (pas l'édition). Cherche dans les sources le nom générique de l'événement récurrent.
- convention.email : L'email de contact UNIQUEMENT s'il est explicitement mentionné dans les sources. NE PAS INVENTER.
- instagramUrl : Le lien vers le compte Instagram s'il est mentionné (format: https://instagram.com/...)

FORMAT ATTENDU:
${JSON_FORMAT_FOR_COMPLETION}

RÈGLES:
1. NE MODIFIE JAMAIS les champs déjà remplis (non vides) - SURTOUT startDate et endDate
2. Complète les champs vides ("" ou null) avec les données des sources
3. convention.name = nom générique de la convention (ex: "Spinfest" pas "Spinfest 2025")
4. convention.email = UNIQUEMENT si trouvé explicitement dans les sources, sinon laisser vide ""
5. instagramUrl = lien Instagram si trouvé dans les sources
6. DATES: Garde le format exact des dates pré-remplies (avec heures si présentes). N'enlève JAMAIS les heures.
7. Réponds UNIQUEMENT avec le JSON complet, sans commentaires`

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
- FETCH_URL: <url> -> Explorer une page supplémentaire (COPIE L'URL EXACTE, ne l'invente pas)
- GENERATE_JSON -> Générer le JSON final avec toutes les informations collectées

IMPORTANT POUR FETCH_URL:
- Cherche "LIENS À EXPLORER" dans le contenu fourni (site officiel, Facebook, etc.)
- COPIE l'URL EXACTE caractère par caractère depuis le contenu
- N'INVENTE JAMAIS d'URL, utilise uniquement celles listées dans le contenu

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
- edition.imageUrl: COPIER EXACTEMENT l'URL og:image trouvée (ne pas modifier les URLs Google lh3.googleusercontent.com)
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
${COMMON_RULES_FULL}

RÈGLES SPÉCIFIQUES À L'EXPLORATION:
- NAVIGATION: Utilise la navigation du site pour trouver les pages importantes (tarifs, infos pratiques, lieu, bénévoles)
- Réponds UNIQUEMENT avec l'action choisie, sans explication

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

DATES AVEC HEURES:
- Cherche les horaires: "à partir de 10h", "ouverture 14h", "début vendredi 18h", "10:00", "14h00"
- Si heure trouvée: format YYYY-MM-DDTHH:MM:SS (ex: 2025-07-15T10:00:00)
- Si pas d'heure: format YYYY-MM-DD

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
- FETCH_URL: <url> -> explorer une page (COPIE L'URL EXACTE du contenu, ne l'invente pas)
- GENERATE_JSON -> générer le JSON final

IMPORTANT POUR FETCH_URL:
- Cherche "LIENS À EXPLORER" dans le contenu fourni
- COPIE l'URL EXACTE caractère par caractère (ex: FETCH_URL: https://www.chocfest.net)
- N'INVENTE JAMAIS d'URL, utilise uniquement celles listées

${generateFieldsSection()}

FORMAT JSON:
${generateCompactJsonFormat()}

DATES AVEC HEURES:
- Cherche les horaires: "à partir de 10h", "ouverture 14h", "début vendredi 18h", "10:00", "14h00"
- Si heure trouvée: format YYYY-MM-DDTHH:MM:SS (ex: 2025-07-15T10:00:00)
- Si pas d'heure: format YYYY-MM-DD

CARACTÉRISTIQUES (true si mentionné): ${generateCompactFeaturesDescription()}

RÈGLES:
${COMMON_RULES_COMPACT}
- NAVIGATION: Utilise la navigation du site pour trouver infos pratiques, tarifs, lieu
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

RÈGLES:
${COMMON_RULES_COMPACT}

IMPORTANT POUR LES DATES:
- Si tu trouves des heures (horaires), inclus-les dans startDate et endDate au format YYYY-MM-DDTHH:MM:SS
- Cherche des indications comme "à partir de 10h", "ouverture 14h", "début vendredi 18h", etc.
- Si aucune heure n'est trouvée, utilise le format YYYY-MM-DD

FORMAT JSON ATTENDU:
${generateCompactJsonFormat()}

Réponds UNIQUEMENT avec le JSON complet, sans FETCH_URL, sans GENERATE_JSON.`
}
