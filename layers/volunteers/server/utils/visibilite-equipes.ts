/**
 * Quelles équipes de bénévolat une personne a le droit de voir.
 *
 * `isVisibleToVolunteers` se règle depuis l'écran des équipes et promet de cacher une équipe. Il ne
 * le faisait qu'à l'affichage : l'API rendait toutes les équipes, et le filtre vivait dans le
 * navigateur, à une ligne du formulaire de candidature. Le nom et la description d'une équipe qu'on
 * ne voulait pas montrer — « Sécurité nuit », « Gestion des conflits » — se lisaient dans la
 * réponse de l'API, par n'importe quel compte connecté.
 *
 * Un réglage qui promet de cacher et ne cache qu'à l'affichage est pire qu'un réglage absent : on
 * s'en sert en croyant qu'il protège.
 *
 * La lecture ouverte de cet endpoint reste voulue — le formulaire de candidature en dépend, et il
 * est consulté avant même d'avoir postulé. Mais « ouvert » ne veut pas dire « tout ».
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La situation de celui qui demande, réduite à ce dont la règle a besoin. */
export interface DemandeurDEquipes {
  /** A-t-il le droit de gérer les bénévoles de cette édition ? */
  estGestionnaire: boolean
  /**
   * Sa candidature est-elle acceptée sur cette édition ?
   *
   * Ce cas existe parce que le réglage dit exactement ce que l'écran promet : « cette équipe est
   * visible **lors de la candidature** des bénévoles ». Il vise le futur candidat, pas la personne
   * déjà dans l'organisation — laquelle voit le planning de l'édition, équipes comprises. Sans
   * cette exception, un bénévole affecté à un créneau d'une équipe cachée ne verrait plus son
   * propre service : le planning résout les équipes depuis cette même liste.
   */
  estBenevoleAccepte: boolean
}

/**
 * La vue la plus restreinte : celle d'un candidat, qui ne voit aucune équipe cachée.
 *
 * Sert de valeur par défaut pour un visiteur sans session, et de vue demandée explicitement par le
 * formulaire de candidature — pour qu'un organisateur qui l'ouvre en aperçu voie ce que le candidat
 * verra, et non ce que ses propres droits lui permettraient.
 */
export const VUE_DE_CANDIDATURE: DemandeurDEquipes = {
  estGestionnaire: false,
  estBenevoleAccepte: false,
}

/** Ce que la requête doit ajouter pour ne rendre que les équipes autorisées. */
export interface FiltreVisibilite {
  isVisibleToVolunteers?: boolean
}

/** Dit si cette personne a accès aux équipes cachées. */
export function voitLesEquipesCachees(demandeur: DemandeurDEquipes): boolean {
  return demandeur.estGestionnaire || demandeur.estBenevoleAccepte
}

/**
 * Le filtre à poser sur la recherche des équipes.
 *
 * Rendu comme un objet à fusionner plutôt qu'appliqué ici : la requête reste dans l'endpoint, seule
 * la décision vit dans ce module.
 */
export function filtreDesEquipesVisibles(demandeur: DemandeurDEquipes): FiltreVisibilite {
  // Volontairement `isVisibleToVolunteers: true` et non `{ not: false }` : la colonne vaut `true`
  // par défaut en base et n'est pas nullable, les deux sont donc équivalents — mais le premier dit
  // ce qu'on veut plutôt que ce qu'on refuse.
  return voitLesEquipesCachees(demandeur) ? {} : { isVisibleToVolunteers: true }
}

/** Une équipe réduite à ce dont la règle a besoin. */
export interface EquipeVisible {
  isVisibleToVolunteers?: boolean | null
}

/**
 * Dit si une équipe donnée doit être montrée à ce demandeur.
 *
 * Sert là où les équipes ne sont pas cherchées directement mais atteintes par une relation — le
 * filtre de requête n'y est alors d'aucun secours. Une équipe dont le champ manque est traitée
 * comme visible, parce que c'est la valeur par défaut de la colonne : une équipe ordinaire ne doit
 * pas disparaître au motif qu'une requête a oublié de sélectionner ce champ.
 */
export function equipeVisiblePour(equipe: EquipeVisible, demandeur: DemandeurDEquipes): boolean {
  return voitLesEquipesCachees(demandeur) || equipe.isVisibleToVolunteers !== false
}
