import type { User } from './index'
import type {
  OrganizerConventionRights,
  OrganizerEditionRights,
} from '~~/shared/utils/organizer-rights'

/**
 * Droits globaux d'un organisateur sur une convention.
 * Dérivé de CONVENTION_RIGHTS : ajouter un droit là-bas suffit.
 */
export type OrganizerRights = OrganizerConventionRights

/**
 * Droits spécifiques d'un organisateur sur une édition.
 * Dérivé de EDITION_RIGHTS.
 */
export interface OrganizerPerEditionRights {
  editionId: number
  rights: OrganizerEditionRights
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
