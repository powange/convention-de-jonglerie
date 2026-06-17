// Ports du module « objets trouvés » (layers/lost-found). Le layer consomme ces interfaces pour
// résoudre les données propres au domaine (ex. la date de début de l'événement) sans lire les
// modèles d'autres modules. Même pattern que server/faq/ports, server/taskboard/ports, etc.

/**
 * Accès aux métadonnées d'événement nécessaires au module objets trouvés. Jonglerie : l'`Edition`
 * (existence + `startDate`). Domaine générique : sa propre résolution.
 */
export interface LostFoundEventPort {
  /**
   * Existence de l'événement + sa date de début. `found: false` → événement inconnu (404).
   * `startDate` sert à la règle « pas d'ajout d'objet avant le début de l'événement ».
   */
  getEventTiming(editionId: number): Promise<{ found: boolean; startDate: Date | null }>
}

export interface LostFoundPorts {
  event: LostFoundEventPort
}
