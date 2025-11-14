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
  },
  volunteer: {
    icon: 'i-heroicons-user-group',
    color: 'primary',
    iconColorClass: 'text-primary-500',
    labelKey: 'common.volunteer',
  },
  artist: {
    icon: 'i-heroicons-star',
    color: 'yellow',
    iconColorClass: 'text-yellow-500',
    labelKey: 'common.artist',
  },
  ticket: {
    icon: 'i-heroicons-ticket',
    color: 'blue',
    iconColorClass: 'text-blue-500',
    labelKey: 'common.ticket',
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
  },
  volunteers: {
    icon: 'i-heroicons-user-group',
    color: 'primary',
    iconColorClass: 'text-primary-500',
    labelKey: 'edition.ticketing.volunteer_management',
  },
  artists: {
    icon: 'i-heroicons-star',
    color: 'yellow',
    iconColorClass: 'text-yellow-500',
    labelKey: 'gestion.artists.title',
  },
  ticketing: {
    icon: 'i-heroicons-ticket',
    color: 'blue',
    iconColorClass: 'text-blue-500',
    labelKey: 'gestion.ticketing.title',
  },
  meals: {
    icon: 'cbi:mealie',
    color: 'orange',
    iconColorClass: 'text-orange-500',
    labelKey: 'gestion.meals.title',
  },
  workshops: {
    icon: 'i-heroicons-academic-cap',
    color: 'indigo',
    iconColorClass: 'text-indigo-500',
    labelKey: 'gestion.workshops.title',
  },
  lostFound: {
    icon: 'i-heroicons-magnifying-glass',
    color: 'amber',
    iconColorClass: 'text-amber-500',
    labelKey: 'edition.lost_found',
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
