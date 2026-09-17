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
 * DEUX exceptions, et elles n'ont pas la même raison :
 *
 * 1. **Les gestionnaires voient toujours tout.** C'est leur écran de travail ; sans cela le
 *    réglage masquerait le planning à celui qui le construit.
 * 2. **Le responsable d'équipe voit en avance.** Il doit pouvoir relire le planning pendant qu'il
 *    se construit pour donner son avis avant publication — il est associé au travail, pas soumis
 *    à son résultat.
 *
 * DEUX QUESTIONS DISTINCTES, qu'il ne faut pas confondre :
 *
 * - **Quand** voit-on le planning ? Publié, tout le monde ; avant, seulement les gestionnaires et
 *   les responsables d'équipe.
 * - **Qui** y voit-on nommément ? Hors gestionnaires, chacun ne voit les personnes que dans les
 *   équipes DONT IL FAIT PARTIE. Les autres équipes lui sont rendues en anonyme : les créneaux,
 *   leurs horaires et leur jauge, sans personne dedans. De quoi repérer un chevauchement ou un
 *   trou sans obtenir sur les autres équipes une visibilité nominative que rien ne justifie.
 *
 * La responsabilité gouverne la première question, l'appartenance la seconde. Un responsable n'a
 * donc pas plus de noms qu'un bénévole ordinaire — il les a seulement plus tôt.
 *
 * ⚠️ La seconde question est un DURCISSEMENT par rapport à ce qui existait : le planning publié
 * rendait tous les noms de toutes les équipes à tout bénévole accepté.
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
  /**
   * Est-il responsable d'au moins une équipe de cette édition, à quelque titre que ce soit ?
   *
   * Ne gouverne QUE l'accès anticipé. Ce qu'il voit nommément dépend de son appartenance, pas de
   * sa responsabilité — un responsable n'a pas plus de noms, il les a plus tôt.
   */
  estResponsableDEquipe?: boolean
}

/**
 * Ce que l'on donne à voir, en trois niveaux plutôt qu'en un booléen.
 *
 * `partiel` n'est pas un demi-`complet` : c'est un niveau à part entière, avec sa propre règle de
 * composition — détail sur ses équipes, anonyme ailleurs. Le confondre avec l'un des deux autres
 * est exactement l'erreur qu'un booléen invitait à faire.
 */
export type NiveauDeVisibilite = 'complet' | 'partiel' | 'aucun'

/**
 * Les créneaux de cette édition sont-ils visibles de cette personne&nbsp;?
 *
 * C'est la seule question que posent les six surfaces d'exposition. Elles n'ont donc pas à
 * connaître le réglage, ni à refaire le raisonnement chacune de leur côté — c'est exactement
 * ainsi qu'une règle finit écrite cinq fois et appliquée trois.
 */
export function planningVisiblePour(demandeur: DemandeurDePlanning): boolean {
  return niveauDeVisibilite(demandeur) !== 'aucun'
}

/**
 * Jusqu'où va ce que cette personne peut voir.
 *
 * L'ordre des trois cas porte la règle : le droit de gestion l'emporte sur tout, la publication
 * rend le planning à tout le monde, et la responsabilité d'équipe n'ouvre qu'un accès partiel —
 * et seulement tant que le planning n'est pas publié, faute de quoi elle le restreindrait au lieu
 * de l'élargir.
 */
export function niveauDeVisibilite(demandeur: DemandeurDePlanning): NiveauDeVisibilite {
  // Le droit de gestion l'emporte sur tout : c'est l'écran de travail de celui qui construit.
  if (demandeur.estGestionnaire) return 'complet'

  // Pour tous les autres, le détail nominatif s'arrête à leurs propres équipes. Reste à savoir
  // s'ils ont accès au planning : la publication l'ouvre à tous, la responsabilité d'équipe
  // l'ouvre en avance.
  if (demandeur.planningPublie === true) return 'partiel'
  if (demandeur.estResponsableDEquipe === true) return 'partiel'

  return 'aucun'
}

/**
 * Le code d'erreur rendu quand le planning n'est pas publié.
 *
 * Nommé, comme `SWAPS_DISABLED` pour les échanges : l'écran doit pouvoir distinguer « rien à
 * afficher » de « pas encore publié » pour en dire la raison, sans avoir à comparer des messages.
 */
export const PLANNING_NON_PUBLIE = 'PLANNING_NOT_PUBLISHED'
