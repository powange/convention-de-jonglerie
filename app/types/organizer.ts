import type { User } from './index'

/**
 * Droits globaux d'un organisateur sur une convention
 */
export interface OrganizerRights {
  editConvention?: boolean
  deleteConvention?: boolean
  manageOrganizers?: boolean
  manageVolunteers?: boolean
  addEdition?: boolean
  editAllEditions?: boolean
  deleteAllEditions?: boolean
  manageMeals?: boolean
  manageTicketing?: boolean
}

/**
 * Droits spécifiques d'un organisateur sur une édition
 */
export interface OrganizerPerEditionRights {
  editionId: number
  rights: {
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
  }
}

/**
 * Données complètes d'un organisateur
 */
export interface Organizer {
  id: number
  userId: number
  user: User
  conventionId: number
  rights: OrganizerRights
  title: string
  perEditionRights?: OrganizerPerEditionRights[]
  perEdition?: OrganizerPerEditionRights[] // Alias pour compatibilité
  createdAt: string
  updatedAt: string
}

/**
 * Données pour la création/modification des droits d'un organisateur
 */
export interface OrganizerRightsFormData {
  rights: OrganizerRights
  title: string
  perEdition: OrganizerPerEditionRights[]
}
