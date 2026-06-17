// Ports du module « covoiturage » (layers/carpool). Le layer consomme ces interfaces pour résoudre
// les données propres au domaine sans lire les modèles d'autres modules. Le couplage du covoiturage
// est minimal : seule l'existence de l'événement est nécessaire (avant de créer une offre/demande).
// Même pattern que server/faq/ports, server/lost-found/ports, server/workshops/ports, etc.

/** Accès aux métadonnées d'événement nécessaires au module covoiturage. */
export interface CarpoolEventPort {
  /** L'événement existe-t-il ? (vérifié avant la création d'une offre/demande de covoiturage). */
  eventExists(editionId: number): Promise<boolean>
}

export interface CarpoolPorts {
  event: CarpoolEventPort
}
