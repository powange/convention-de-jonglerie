/**
 * Source unique de vérité pour les services/caractéristiques d'une édition.
 *
 * Ajouter un nouveau service :
 *   1. Ajouter la colonne booléenne dans `prisma/schema/schema.prisma` (Edition)
 *   2. Ajouter le champ dans `editionSchema` + `updateEditionSchema`
 *      (server/utils/validation-schemas.ts)
 *   3. Ajouter le champ dans le helper `editionListInclude` ou équivalent
 *      (server/utils/prisma-select-helpers.ts) si besoin de l'exposer
 *   4. Ajouter une entrée dans la constante `conventionServices` ci-dessous
 *      (key, i18nKey, icon, color, category, importLabel)
 *   5. Ajouter la clé i18n correspondante dans tous les fichiers de
 *      `i18n/locales/{langue}/public.json` (sous `services.*`)
 *
 * Le test test/unit/utils/conventionServices.test.ts garantit que les clés
 * de cette liste correspondent aux colonnes Prisma (filet de sécurité).
 */

export type ConventionServiceCategory =
  | 'accommodation'
  | 'food'
  | 'activities'
  | 'amenities'
  | 'payment'

export interface ConventionService {
  /** Clé technique (correspond au nom de la colonne Prisma sur Edition) */
  key: keyof ConventionServiceKeys
  /** Clé i18n (sous `services.*` dans public.json) */
  i18nKey: string
  /** Icône Nuxt Icon */
  icon: string
  /** Classe Tailwind text-* pour la couleur */
  color: string
  /** Catégorie pour le groupement par section */
  category: ConventionServiceCategory
  /**
   * Label court utilisé dans les prompts IA d'import (lowercase, sans
   * majuscules). Si absent, on génère depuis i18nKey en français.
   */
  importLabel?: string
}

export interface ConventionServiceKeys {
  hasFoodTrucks: boolean
  hasKidsZone: boolean
  acceptsPets: boolean
  hasTentCamping: boolean
  hasTruckCamping: boolean
  hasFamilyCamping: boolean
  hasSleepingRoom: boolean
  hasGym: boolean
  hasFireSpace: boolean
  hasGala: boolean
  hasOpenStage: boolean
  hasConcert: boolean
  hasCantine: boolean
  hasAerialSpace: boolean
  hasSlacklineSpace: boolean
  hasUnicycleSpace: boolean
  hasToilets: boolean
  hasShowers: boolean
  hasAccessibility: boolean
  hasWorkshops: boolean
  hasCashPayment: boolean
  hasCreditCardPayment: boolean
  hasAfjTokenPayment: boolean
  hasLongShow: boolean
  hasATM: boolean
}

export const conventionServices: ConventionService[] = [
  // ── Hébergement ──
  {
    key: 'hasTentCamping',
    i18nKey: 'services.tent_camping',
    icon: 'i-mdi:tent',
    color: 'text-green-600',
    category: 'accommodation',
    importLabel: 'camping tente',
  },
  {
    key: 'hasTruckCamping',
    i18nKey: 'services.truck_camping',
    icon: 'i-heroicons-truck',
    color: 'text-blue-500',
    category: 'accommodation',
    importLabel: 'camping-car',
  },
  {
    key: 'hasFamilyCamping',
    i18nKey: 'services.family_camping',
    icon: 'i-heroicons-users',
    color: 'text-indigo-500',
    category: 'accommodation',
    importLabel: 'camping famille',
  },
  {
    key: 'hasSleepingRoom',
    i18nKey: 'services.sleeping_room',
    icon: 'i-uil:bed',
    color: 'text-slate-600',
    category: 'accommodation',
    importLabel: 'dortoir',
  },
  // ── Restauration ──
  {
    key: 'hasFoodTrucks',
    i18nKey: 'services.food_trucks',
    icon: 'i-mdi:food-outline',
    color: 'text-orange-500',
    category: 'food',
    importLabel: 'food trucks',
  },
  {
    key: 'hasCantine',
    i18nKey: 'services.canteen',
    icon: 'cbi:mealie',
    color: 'text-amber-500',
    category: 'food',
    importLabel: 'cantine',
  },
  // ── Activités ──
  {
    key: 'hasGym',
    i18nKey: 'services.gym',
    icon: 'i-ph:court-basketball-light',
    color: 'text-purple-500',
    category: 'activities',
    importLabel: 'gymnase',
  },
  {
    key: 'hasFireSpace',
    i18nKey: 'services.fire_space',
    icon: 'i-heroicons-fire',
    color: 'text-red-600',
    category: 'activities',
    importLabel: 'espace feu',
  },
  {
    key: 'hasGala',
    i18nKey: 'services.gala',
    icon: 'i-heroicons-star',
    color: 'text-yellow-500',
    category: 'activities',
    importLabel: 'gala',
  },
  {
    key: 'hasOpenStage',
    i18nKey: 'services.open_stage',
    icon: 'i-heroicons-sparkles',
    color: 'text-cyan-500',
    category: 'activities',
    importLabel: 'scène ouverte',
  },
  {
    key: 'hasLongShow',
    i18nKey: 'services.long_show',
    icon: 'i-streamline-ultimate:show-theater-masks',
    color: 'text-purple-600',
    category: 'activities',
    importLabel: 'spectacle long',
  },
  {
    key: 'hasConcert',
    i18nKey: 'services.concert',
    icon: 'i-heroicons-musical-note',
    color: 'text-violet-500',
    category: 'activities',
    importLabel: 'concert',
  },
  {
    key: 'hasWorkshops',
    i18nKey: 'services.workshops',
    icon: 'i-material-symbols-light:workspaces-outline',
    color: 'text-slate-600',
    category: 'activities',
    importLabel: 'ateliers',
  },
  {
    key: 'hasAerialSpace',
    i18nKey: 'services.aerial_space',
    icon: 'i-heroicons-cloud',
    color: 'text-sky-500',
    category: 'activities',
    importLabel: 'espace aérien/trapèze',
  },
  {
    key: 'hasSlacklineSpace',
    i18nKey: 'services.slackline_space',
    icon: 'i-heroicons-minus',
    color: 'text-teal-500',
    category: 'activities',
    importLabel: 'slackline',
  },
  {
    key: 'hasUnicycleSpace',
    i18nKey: 'services.unicycle_space',
    icon: 'i-mdi:unicycle',
    color: 'text-lime-600',
    category: 'activities',
    importLabel: 'espace monocycle',
  },
  // ── Commodités ──
  {
    key: 'hasKidsZone',
    i18nKey: 'services.kids_zone',
    icon: 'i-heroicons-face-smile',
    color: 'text-pink-500',
    category: 'amenities',
    importLabel: 'zone enfants',
  },
  {
    key: 'acceptsPets',
    i18nKey: 'services.pets_accepted',
    icon: 'i-material-symbols:pets',
    color: 'text-amber-600',
    category: 'amenities',
    importLabel: 'animaux acceptés',
  },
  {
    key: 'hasToilets',
    i18nKey: 'services.toilets',
    icon: 'i-guidance:wc',
    color: 'text-gray-600',
    category: 'amenities',
    importLabel: 'WC',
  },
  {
    key: 'hasShowers',
    i18nKey: 'services.showers',
    icon: 'i-material-symbols-light:shower-outline',
    color: 'text-blue-400',
    category: 'amenities',
    importLabel: 'douches',
  },
  {
    key: 'hasAccessibility',
    i18nKey: 'services.accessibility',
    icon: 'i-bx:handicap',
    color: 'text-blue-600',
    category: 'amenities',
    importLabel: 'accessibilité PMR',
  },
  {
    key: 'hasATM',
    i18nKey: 'services.atm',
    icon: 'i-heroicons-banknotes',
    color: 'text-green-600',
    category: 'amenities',
    importLabel: 'distributeur',
  },
  // ── Paiements ──
  {
    key: 'hasCashPayment',
    i18nKey: 'services.cash_payment',
    icon: 'i-heroicons-banknotes',
    color: 'text-green-700',
    category: 'payment',
    importLabel: 'paiement espèces',
  },
  {
    key: 'hasCreditCardPayment',
    i18nKey: 'services.credit_card_payment',
    icon: 'i-heroicons-credit-card',
    color: 'text-emerald-600',
    category: 'payment',
    importLabel: 'paiement CB',
  },
  {
    key: 'hasAfjTokenPayment',
    i18nKey: 'services.afj_token_payment',
    icon: 'i-heroicons-currency-dollar',
    color: 'text-orange-600',
    category: 'payment',
    importLabel: 'jetons AFJ',
  },
]

/** Liste ordonnée des catégories (pour l'ordre d'affichage) */
export const SERVICE_CATEGORIES: ConventionServiceCategory[] = [
  'accommodation',
  'food',
  'activities',
  'amenities',
  'payment',
]

/** Liste des clés (utile pour validation et test de cohérence avec Prisma) */
export const CONVENTION_SERVICE_KEYS = conventionServices.map((s) => s.key)

export const getServiceByKey = (
  key: keyof ConventionServiceKeys
): ConventionService | undefined => {
  return conventionServices.find((service) => service.key === key)
}

export const getActiveServices = (
  convention: Partial<ConventionServiceKeys>
): ConventionService[] => {
  return conventionServices.filter((service) => convention[service.key])
}

/**
 * Retourne les services groupés par catégorie, dans l'ordre défini par
 * SERVICE_CATEGORIES.
 */
export const getServicesByCategory = (): Array<{
  category: ConventionServiceCategory
  services: ConventionService[]
}> => {
  return SERVICE_CATEGORIES.map((category) => ({
    category,
    services: conventionServices.filter((s) => s.category === category),
  }))
}
