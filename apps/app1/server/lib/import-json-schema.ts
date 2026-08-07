/**
 * Schéma et prompt pour la génération de JSON d'import via IA
 * Utilisé par l'agent d'exploration (EI) et la génération directe (ED)
 *
 * Les textes des prompts sont dans server/prompts/*.txt
 * Ce fichier contient les données dynamiques (listes de features, format JSON)
 * et les fonctions qui assemblent les prompts finaux via loadPrompt().
 */

import { conventionServices } from '~/utils/convention-services'

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
  'region (Région/État/Province), timezone, imageUrl, ticketingUrl, facebookUrl, instagramUrl, jugglingEdgeUrl, latitude, longitude, programUrl (page externe du programme), programDays (programme jour par jour, à privilégier), program (programme sans date)'

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
    "imageUrl": "optionnel",
    "programUrl": "optionnel - URL d'une page décrivant le programme",
    "programDays": "optionnel - À PRIVILÉGIER - [{ \\"date\\": \\"YYYY-MM-DD\\", \\"content\\": \\"déroulé de cette journée\\" }]",
    "program": "optionnel - uniquement ce qui ne se rattache à aucune journée précise"
  }
}`

/**
 * Prompt pour compléter un JSON pré-rempli (Facebook + autres sources)
 * Utilisé par ED et EI quand des données Facebook sont disponibles
 */
export function getPrefilledJsonPrompt(): string {
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

    // Programme
    //
    // Deux champs pour une seule information, et un ordre de préférence : une convention se vit
    // jour par jour, et un programme découpé se lit sur place bien mieux qu'un bloc unique.
    // Le champ général ne garde que ce qui ne se rattache à aucune date.
    programUrl: {
      required: false,
      description:
        "URL d'une page décrivant le programme, quand la source y renvoie plutôt que de le " +
        'détailler. Se cumule avec les deux champs suivants sans les remplacer.',
    },
    programDays: {
      required: false,
      description:
        "À PRIVILÉGIER dès que la source détaille le déroulé. Tableau d'objets " +
        '{ "date": "YYYY-MM-DD", "content": "déroulé de cette journée" }, une entrée par ' +
        "journée mentionnée, uniquement pour les jours compris dans les dates de l'édition.",
    },
    program: {
      required: false,
      description:
        "Programme général. N'y mettre que ce qui ne se rattache à aucune journée précise " +
        "(principes de vie commune, tarifs, plan d'accès). Ne pas y recopier le déroulé " +
        'jour par jour : il va dans programDays.',
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
        programUrl: 'https://.../programme',
        programDays: [
          { date: '2025-07-15', content: 'Accueil à partir de 14h, repas partagé le soir' },
          { date: '2025-07-16', content: 'Ateliers le matin, gala à 20h30' },
        ],
        program: 'Ce qui ne se rattache à aucune journée précise, sinon chaîne vide',
        volunteersOpen: false,
        volunteersDescription: '',
        volunteersExternalUrl: '',
        // Caractéristiques (mettre true si mentionné) — généré depuis la liste
        // centrale conventionServices pour rester en phase quand on ajoute un service.
        ...Object.fromEntries(conventionServices.map((s) => [s.key, false])),
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
 * Liste des caractéristiques avec leurs labels pour le prompt compact.
 * Dérivée de la source unique `conventionServices` : ajouter un service =
 * il apparaît automatiquement dans le prompt IA.
 *
 * Note: status n'est pas inclus car une édition importée est toujours
 * publiée (PUBLISHED).
 */
export const COMPACT_FEATURES_LIST = conventionServices.map((s) => ({
  key: s.key,
  label: s.importLabel || s.key,
}))

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
      programUrl: '',
      programDays: [{ date: 'YYYY-MM-DD', content: '' }],
      program: '',
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
  return loadPrompt('agent-full', {
    FEATURES_DESCRIPTION: generateFeaturesDescription(),
    JSON_EXAMPLE: generateJsonExample(),
    RULES_FULL: loadPrompt('rules-full'),
  })
}

/**
 * Génère un prompt système compact pour ED (Extraction Directe)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export function generateCompactDirectPrompt(): string {
  return loadPrompt('direct-compact', {
    FIELDS_SECTION: generateFieldsSection(),
    RULES_COMPACT: loadPrompt('rules-compact'),
    COMPACT_FEATURES: generateCompactFeaturesDescription(),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}

/**
 * Génère un prompt système compact pour EI (Exploration Intelligente)
 * Pour les modèles avec contexte limité (4k tokens)
 */
export function generateCompactAgentSystemPrompt(): string {
  return loadPrompt('agent-compact', {
    FIELDS_SECTION: generateFieldsSection(),
    RULES_COMPACT: loadPrompt('rules-compact'),
    COMPACT_FEATURES: generateCompactFeaturesDescription(),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}

/**
 * Prompt d'une journée unique.
 *
 * Demander les neuf journées d'un coup n'en rendait que quatre : un modèle local suit mal une
 * consigne qui exige de balayer toute une page et d'en trier neuf sections. Découpé, chaque appel
 * ne pose qu'une question, sur la page entière — c'est bien plus à sa portée.
 *
 * Le nom du jour est fourni dans les deux langues, et son rang dans la convention : les pages de
 * programme désignent les journées tantôt par leur date, tantôt par « Saturday », tantôt par
 * « day 3 ».
 */
export function generateProgramDayPrompt(params: {
  date: string
  jourFr: string
  jourEn: string
  index: number
  total: number
  startDate: string
  endDate: string
}): string {
  return loadPrompt('program-day', {
    DATE: params.date,
    JOUR_FR: params.jourFr,
    JOUR_EN: params.jourEn,
    INDEX: String(params.index),
    TOTAL: String(params.total),
    START_DATE: params.startDate,
    END_DATE: params.endDate,
  })
}

/**
 * Génère le prompt de forçage de génération JSON
 */
export function generateForceGenerationPrompt(
  visitedUrls: string[],
  contentSummary: string
): string {
  return loadPrompt('force-generation', {
    VISITED_COUNT: String(visitedUrls.length),
    CONTENT_SUMMARY: contentSummary,
    RULES_COMPACT: loadPrompt('rules-compact'),
    COMPACT_JSON_FORMAT: generateCompactJsonFormat(),
  })
}
