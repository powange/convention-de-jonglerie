/**
 * Où mène le bouton placé à côté du titre d'une conversation de la messagerie.
 *
 * Une conversation d'édition porte sur un sujet — une équipe, une candidature, un spectacle — et
 * le bouton ouvre la page de l'application qui le concerne. Laquelle dépend de QUI lit : celui
 * qui gère ce sujet arrive dans la gestion de l'édition, le bénévole ou l'artiste sur sa page
 * publique.
 *
 * « Gérer » se lit sur les droits réels de l'édition (gérer les bénévoles, gérer les artistes), et
 * non sur un titre d'organisateur : un bouton qui mène à une page de gestion refusée ne donne pas
 * un encart vide, il empêche la page de s'afficher. Un organisateur rattaché à une équipe sans le
 * droit de gérer les bénévoles est donc traité comme un responsable d'équipe.
 *
 * Les conversations privées entre deux personnes ne relèvent d'aucune édition : pas de bouton.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

export type TypeDeConversation =
  | 'TEAM_GROUP'
  | 'TEAM_LEADER_PRIVATE'
  | 'VOLUNTEER_TO_ORGANIZERS'
  | 'ORGANIZERS_GROUP'
  | 'PRIVATE'
  | 'ARTIST_APPLICATION'
  | 'SHOW_GROUP'

/** Nomme la page visée ; l'écran en tire le libellé et l'icône du bouton. */
export type CibleDeConversation =
  | 'benevolat-public'
  | 'gestion-candidatures-benevoles'
  | 'gestion-accueil'
  | 'appel-spectacles'
  | 'gestion-candidature-artiste'
  | 'espace-artiste'
  | 'gestion-spectacles'

export interface DestinationDeConversation {
  cible: CibleDeConversation
  to: string
}

export interface ConversationADestination {
  type: TypeDeConversation
  editionId: number
  /** Pour une candidature d'artiste : l'appel à spectacles et la candidature. */
  appelASpectaclesId?: number | null
  candidatureArtisteId?: number | null
}

export interface DroitsDuLecteur {
  gereBenevoles: boolean
  gereArtistes: boolean
}

export function destinationDeConversation(
  conversation: ConversationADestination,
  droits: DroitsDuLecteur
): DestinationDeConversation | null {
  const edition = `/editions/${conversation.editionId}`

  switch (conversation.type) {
    case 'TEAM_GROUP':
    case 'TEAM_LEADER_PRIVATE':
    case 'VOLUNTEER_TO_ORGANIZERS':
      return droits.gereBenevoles
        ? {
            cible: 'gestion-candidatures-benevoles',
            to: `${edition}/gestion/volunteers/applications`,
          }
        : { cible: 'benevolat-public', to: `${edition}/volunteers` }

    case 'ORGANIZERS_GROUP':
      return { cible: 'gestion-accueil', to: `${edition}/gestion` }

    case 'ARTIST_APPLICATION': {
      const appel = conversation.appelASpectaclesId
      // Sans appel connu, aucune des deux pages n'a d'adresse : pas de bouton plutôt qu'un
      // lien vers une page introuvable.
      if (!appel) return null
      if (droits.gereArtistes) {
        return conversation.candidatureArtisteId
          ? {
              cible: 'gestion-candidature-artiste',
              to: `${edition}/gestion/shows-call/${appel}/applications/${conversation.candidatureArtisteId}`,
            }
          : null
      }
      return { cible: 'appel-spectacles', to: `${edition}/shows-call/${appel}` }
    }

    case 'SHOW_GROUP':
      return droits.gereArtistes
        ? { cible: 'gestion-spectacles', to: `${edition}/gestion/artists/shows` }
        : { cible: 'espace-artiste', to: `${edition}/artist-space` }

    case 'PRIVATE':
      return null
  }
}
