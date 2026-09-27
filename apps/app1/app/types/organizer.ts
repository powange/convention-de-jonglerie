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
 *
 * Les droits sont À PLAT, à côté de `editionId` : c'est la forme que rendent les deux points d'API
 * (`editions/:id` et `conventions/:id/dashboard`) et celle que lit le store. Ce type annonçait un
 * objet `rights` imbriqué, qui n'a jamais existé — d'où une branche de la modale d'édition typée sur
 * une forme fantôme, qui aurait produit des entrées sans aucun droit.
 */
export type OrganizerPerEditionRights = {
  editionId: number
} & OrganizerEditionRights

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
