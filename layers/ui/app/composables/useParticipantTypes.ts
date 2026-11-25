/**
 * Composable pour gérer les types de participants et leurs caractéristiques visuelles
 * Centralise les couleurs, icônes et labels pour une cohérence dans toute l'application
 */

export type ParticipantType = 'organizer' | 'volunteer' | 'artist' | 'ticket'

export interface ParticipantTypeConfig {
  /** Nom de l'icône Heroicons */
  icon: string
  /** Couleur Tailwind (sans le suffixe -500) */
  color: string
  /** Classe CSS complète pour la couleur de l'icône */
  iconColorClass: string
  /** Label de traduction i18n */
  labelKey: string
  /** Classes CSS pour le mode clair */
  bgClass: string
  textClass: string
  /** Classes CSS pour le mode sombre */
  darkBgClass: string
  darkTextClass: string
  /** Classes CSS pour le hover en mode clair */
  hoverBgClass: string
  /** Classes CSS pour le hover en mode sombre */
  darkHoverBgClass: string
  /** Couleur RGBA pour les graphiques (background avec transparence) */
  chartBgColor: string
  /** Couleur RGBA pour les graphiques (bordure sans transparence) */
  chartBorderColor: string
}

export type ManagementSectionType =
  | 'organizers'
  | 'volunteers'
  | 'artists'
  | 'ticketing'
  | 'meals'
  | 'workshops'
  | 'lostFound'

export interface ManagementSectionConfig {
  /** Nom de l'icône */
  icon: string
  /** Couleur Tailwind (sans le suffixe -500) */
  color: string
  /** Classe CSS complète pour la couleur de l'icône */
  iconColorClass: string
  /** Label de traduction i18n */
  labelKey: string
  /** Classes CSS pour le mode clair */
  bgClass: string
  textClass: string
  /** Classes CSS pour le mode sombre */
  darkBgClass: string
  darkTextClass: string
  /** Classes CSS pour le hover en mode clair */
  hoverBgClass: string
  /** Classes CSS pour le hover en mode sombre */
  darkHoverBgClass: string
}

/**
 * Configuration des types de participants
 */
const participantTypesConfig: Record<ParticipantType, ParticipantTypeConfig> = {
  organizer: {
    icon: 'i-heroicons-user-group',
    color: 'purple',
    iconColorClass: 'text-purple-500',
    labelKey: 'common.organizer',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-600',
    darkBgClass: 'dark:bg-purple-900/20',
    darkTextClass: 'dark:text-purple-400',
    hoverBgClass: 'hover:bg-purple-100',
    darkHoverBgClass: 'dark:hover:bg-purple-900/30',
    chartBgColor: 'rgba(168, 85, 247, 0.8)', // purple-500
    chartBorderColor: 'rgba(168, 85, 247, 1)',
  },
  volunteer: {
    icon: 'i-heroicons-user-group',
    color: 'primary',
    iconColorClass: 'text-primary-500',
    labelKey: 'common.volunteer',
    bgClass: 'bg-primary-50',
    textClass: 'text-primary-600',
    darkBgClass: 'dark:bg-primary-900/20',
    darkTextClass: 'dark:text-primary-400',
    hoverBgClass: 'hover:bg-primary-100',
    darkHoverBgClass: 'dark:hover:bg-primary-900/30',
    chartBgColor: 'rgba(34, 197, 94, 0.8)', // primary/green-500
    chartBorderColor: 'rgba(34, 197, 94, 1)',
  },
  artist: {
    icon: 'i-heroicons-star',
    color: 'yellow',
    iconColorClass: 'text-yellow-500',
    labelKey: 'common.artist',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-600',
    darkBgClass: 'dark:bg-yellow-900/20',
    darkTextClass: 'dark:text-yellow-400',
    hoverBgClass: 'hover:bg-yellow-100',
    darkHoverBgClass: 'dark:hover:bg-yellow-900/30',
    chartBgColor: 'rgba(234, 179, 8, 0.8)', // yellow-500
    chartBorderColor: 'rgba(234, 179, 8, 1)',
  },
  ticket: {
    icon: 'i-heroicons-ticket',
    color: 'blue',
    iconColorClass: 'text-blue-500',
    labelKey: 'common.ticket',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
    darkBgClass: 'dark:bg-blue-900/20',
    darkTextClass: 'dark:text-blue-400',
    hoverBgClass: 'hover:bg-blue-100',
    darkHoverBgClass: 'dark:hover:bg-blue-900/30',
    chartBgColor: 'rgba(59, 130, 246, 0.8)', // blue-500
    chartBorderColor: 'rgba(59, 130, 246, 1)',
  },
}

/**
 * Configuration des sections de gestion
 */
const managementSectionsConfig: Record<ManagementSectionType, ManagementSectionConfig> = {
  organizers: {
    icon: 'i-heroicons-user-group',
    color: 'purple',
    iconColorClass: 'text-purple-500',
    labelKey: 'organizers.title',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-600',
    darkBgClass: 'dark:bg-purple-900/20',
    darkTextClass: 'dark:text-purple-400',
    hoverBgClass: 'hover:bg-purple-100',
    darkHoverBgClass: 'dark:hover:bg-purple-900/30',
  },
  volunteers: {
    icon: 'i-heroicons-user-group',
    color: 'primary',
    iconColorClass: 'text-primary-500',
    labelKey: 'edition.ticketing.volunteer_management',
    bgClass: 'bg-primary-50',
    textClass: 'text-primary-600',
    darkBgClass: 'dark:bg-primary-900/20',
    darkTextClass: 'dark:text-primary-400',
    hoverBgClass: 'hover:bg-primary-100',
    darkHoverBgClass: 'dark:hover:bg-primary-900/30',
  },
  artists: {
    icon: 'i-heroicons-star',
    color: 'yellow',
    iconColorClass: 'text-yellow-500',
    labelKey: 'gestion.artists.title',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-600',
    darkBgClass: 'dark:bg-yellow-900/20',
    darkTextClass: 'dark:text-yellow-400',
    hoverBgClass: 'hover:bg-yellow-100',
    darkHoverBgClass: 'dark:hover:bg-yellow-900/30',
  },
  ticketing: {
    icon: 'i-heroicons-ticket',
    color: 'blue',
    iconColorClass: 'text-blue-500',
    labelKey: 'gestion.ticketing.title',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
    darkBgClass: 'dark:bg-blue-900/20',
    darkTextClass: 'dark:text-blue-400',
    hoverBgClass: 'hover:bg-blue-100',
    darkHoverBgClass: 'dark:hover:bg-blue-900/30',
  },
  meals: {
    icon: 'cbi:mealie',
    color: 'orange',
    iconColorClass: 'text-orange-500',
    labelKey: 'gestion.meals.title',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-600',
    darkBgClass: 'dark:bg-orange-900/20',
    darkTextClass: 'dark:text-orange-400',
    hoverBgClass: 'hover:bg-orange-100',
    darkHoverBgClass: 'dark:hover:bg-orange-900/30',
  },
  workshops: {
    icon: 'i-heroicons-academic-cap',
    color: 'indigo',
    iconColorClass: 'text-indigo-500',
    labelKey: 'gestion.workshops.title',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-600',
    darkBgClass: 'dark:bg-indigo-900/20',
    darkTextClass: 'dark:text-indigo-400',
    hoverBgClass: 'hover:bg-indigo-100',
    darkHoverBgClass: 'dark:hover:bg-indigo-900/30',
  },
  lostFound: {
    icon: 'i-heroicons-magnifying-glass',
    color: 'amber',
    iconColorClass: 'text-amber-500',
    labelKey: 'edition.lost_found',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-600',
    darkBgClass: 'dark:bg-amber-900/20',
    darkTextClass: 'dark:text-amber-400',
    hoverBgClass: 'hover:bg-amber-100',
    darkHoverBgClass: 'dark:hover:bg-amber-900/30',
  },
}

export function useParticipantTypes() {
  /**
   * Obtenir la configuration d'un type de participant
   */
  const getParticipantTypeConfig = (type: ParticipantType): ParticipantTypeConfig => {
    return participantTypesConfig[type]
  }

  /**
   * Obtenir la configuration d'une section de gestion
   */
  const getManagementSectionConfig = (section: ManagementSectionType): ManagementSectionConfig => {
    return managementSectionsConfig[section]
  }

  /**
   * Obtenir l'icône d'un type de participant
   */
  const getParticipantIcon = (type: ParticipantType): string => {
    return participantTypesConfig[type].icon
  }

  /**
   * Obtenir la couleur d'un type de participant
   */
  const getParticipantColor = (type: ParticipantType): string => {
    return participantTypesConfig[type].color
  }

  /**
   * Obtenir la classe CSS de couleur d'icône d'un type de participant
   */
  const getParticipantIconColorClass = (type: ParticipantType): string => {
    return participantTypesConfig[type].iconColorClass
  }

  /**
   * Obtenir le label i18n d'un type de participant
   */
  const getParticipantLabel = (type: ParticipantType): string => {
    return participantTypesConfig[type].labelKey
  }

  return {
    // Configs complètes
    getParticipantTypeConfig,
    getManagementSectionConfig,

    // Accès rapides pour les participants
    getParticipantIcon,
    getParticipantColor,
    getParticipantIconColorClass,
    getParticipantLabel,

    // Types pour export
    participantTypes: participantTypesConfig,
    managementSections: managementSectionsConfig,
  }
}
