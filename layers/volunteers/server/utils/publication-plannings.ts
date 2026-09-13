/**
 * Qui a le droit de voir les créneaux d'une édition, selon que son planning est publié ou non.
 *
 * Un responsable construit ses plannings par itérations : il place une équipe, se ravise, déplace
 * un créneau, en supprime un autre. Tant que ce travail était immédiatement visible, un bénévole
 * accepté voyait apparaître puis disparaître des services au fil de la journée — et notait dans
 * son agenda des horaires qui n'existeraient plus le lendemain. Le réglage `planningPublished`
 * existe pour que le responsable dise lui-même quand c'est prêt.
 *
 * ⚠️ Le filtre est SERVEUR, et c'est la leçon de `visibilite-equipes.ts` : là-bas, un réglage qui
 * promettait de cacher des équipes ne cachait qu'à l'affichage, l'API rendant tout. « Un réglage
 * qui promet de cacher et ne cache qu'à l'affichage est pire qu'un réglage absent : on s'en sert
 * en croyant qu'il protège. » Un `v-if` ne protège rien ; il rend seulement l'écran cohérent avec
 * ce que le serveur a déjà décidé.
 *
 * Le masquage porte sur le planning ENTIER, affectations d'équipe comprises : savoir qu'on est
 * placé dans « Bar - nuit » est déjà un résultat du travail de planification.
 *
 * Une seule exception, décidée et à ne pas rouvrir : **les gestionnaires voient toujours tout.**
 * C'est leur écran de travail ; sans cela le réglage masquerait le planning à celui qui le
 * construit.
 *
 * En particulier, les créneaux tenus comme ORGANISATEUR sont masqués eux aussi. Ils sont le
 * résultat du même travail de planification — ils se placent, se déplacent et se suppriment au fil
 * des itérations — et les montrer pendant la construction donnerait des horaires qu'on note et qui
 * changeront. Une première version les exemptait ; c'était une erreur de lecture du besoin.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La situation de celui qui demande, réduite à ce dont la règle a besoin. */
export interface DemandeurDePlanning {
  /** A-t-il le droit de gérer les bénévoles de cette édition ? */
  estGestionnaire: boolean
  /**
   * Le réglage de l'édition.
   *
   * `null` ou `undefined` — une édition qui n'a jamais rien configuré — vaut **non publié** : le
   * défaut du schéma est `false`, et une absence ne doit pas ouvrir ce qu'un réglage fermerait.
   */
  planningPublie?: boolean | null
}

/**
 * Les créneaux de cette édition sont-ils visibles de cette personne&nbsp;?
 *
 * C'est la seule question que posent les six surfaces d'exposition. Elles n'ont donc pas à
 * connaître le réglage, ni à refaire le raisonnement chacune de leur côté — c'est exactement
 * ainsi qu'une règle finit écrite cinq fois et appliquée trois.
 */
export function planningVisiblePour(demandeur: DemandeurDePlanning): boolean {
  if (demandeur.estGestionnaire) return true

  return demandeur.planningPublie === true
}

/**
 * Le code d'erreur rendu quand le planning n'est pas publié.
 *
 * Nommé, comme `SWAPS_DISABLED` pour les échanges : l'écran doit pouvoir distinguer « rien à
 * afficher » de « pas encore publié » pour en dire la raison, sans avoir à comparer des messages.
 */
export const PLANNING_NON_PUBLIE = 'PLANNING_NOT_PUBLISHED'
