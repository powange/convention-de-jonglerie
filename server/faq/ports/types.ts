// Ports du module « FAQ » (layers/faq). Le layer consomme ces interfaces pour résoudre les données
// propres au domaine (ex. la FAQ est-elle publique pour cet événement ?) sans lire les modèles
// d'autres modules. Même pattern que server/volunteers/ports, server/meals/ports, server/taskboard/ports.

/**
 * Visibilité de la FAQ, propre au domaine. Jonglerie : flags `faqEnabled` / `faqPagePublic` portés
 * par l'`Edition`. Domaine générique : sa propre résolution (ou tout désactivé).
 */
export interface FaqDirectoryPort {
  /**
   * État de publication de la FAQ pour un événement. `enabled: false` → module FAQ désactivé ;
   * `pagePublic: false` → page publique masquée (un éditeur garde l'accès, pas un visiteur).
   */
  getFaqVisibility(editionId: number): Promise<{ enabled: boolean; pagePublic: boolean }>
}

export interface FaqPorts {
  directory: FaqDirectoryPort
}
