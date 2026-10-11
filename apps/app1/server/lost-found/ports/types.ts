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
  /**
   * L'existence de l'événement, sa date de début, et de quoi décider QUI peut le lire.
   *
   * ⚠️ `visibilite` est arrivé avec l'ouverture au public de la liste des objets trouvés
   * (constat B1) : la route étant désormais atteignable sans compte, le handler doit pouvoir
   * refuser une édition retirée de la vue du public. Les trois champs sont exactement ce
   * qu'attend `assurerEditionLisible` — y compris `conventionAuthorId`, qui sert à reconnaître une
   * édition ORPHELINE, lisible de tous faute de quoi personne ne pourrait jamais la lire.
   *
   * Le port les rend dans la MÊME lecture que `found` : une seconde requête pour une décision
   * prise à la ligne suivante serait un aller-retour de plus sur chaque affichage.
   */
  getEventTiming(editionId: number): Promise<{
    found: boolean
    startDate: Date | null
    visibilite: {
      status: string
      creatorId: number | null
      conventionAuthorId: number | null
    } | null
  }>
}

export interface LostFoundPorts {
  event: LostFoundEventPort
}
