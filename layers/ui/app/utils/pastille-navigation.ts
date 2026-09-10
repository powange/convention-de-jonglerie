/**
 * Ce qu'un compteur affiche, et quand il n'affiche rien.
 *
 * Une pastille n'a d'intérêt que si elle veut dire quelque chose. Un menu constellé de pastilles ne
 * signale plus rien, et une pastille qui affiche « 0 » est une tache sans message — c'est d'ailleurs
 * le premier piège de ce genre de mécanisme, et la raison pour laquelle la règle vit à part plutôt
 * que dans le composant qui la rend.
 *
 * Rien ici ne parle d'un domaine : ni édition, ni matériel. C'est ce qui permet à une autre
 * application du dépôt de reprendre ce fichier tel quel.
 */

/**
 * L'urgence de ce que le compteur signale.
 *
 * Trois tons et pas davantage : au-delà, la couleur cesse d'être lue et redevient de la décoration.
 */
export type TonPastille = 'neutre' | 'attention' | 'urgent'

/** Une pastille prête à afficher. */
export interface PastilleNavigation {
  /** Ce qui est écrit dedans — jamais vide. */
  texte: string
  ton: TonPastille
}

export interface OptionsPastille {
  /**
   * Au-delà, le compte cède la place à « <maximum>+ ».
   *
   * Trois chiffres suffisent à dire « beaucoup » ; un quatrième déforme le menu sans rien
   * apprendre, puisque personne ne traite 1 248 choses à la suite.
   */
  maximum?: number
  /** Le ton à partir de 1. */
  ton?: TonPastille
  /**
   * À partir de ce compte, le ton passe à `urgent`.
   *
   * Sépare « il y a des choses à faire » de « il y en a trop » — sans quoi le même rouge sert du
   * premier au centième, et cesse de distinguer.
   */
  seuilUrgent?: number
}

const MAXIMUM_PAR_DEFAUT = 99

/**
 * La pastille d'un compteur, ou `null` quand il n'y a rien à signaler.
 *
 * `null` et non une pastille vide : c'est à l'appelant de ne rien rendre, et un objet « vide »
 * finirait par s'afficher quelque part sous la forme d'un point sans texte.
 *
 * Un compte négatif, absent ou non fini est traité comme zéro plutôt que rejeté : un compteur qui
 * casse une barre de navigation entière parce qu'une requête a mal tourné serait un remède pire
 * que le mal.
 */
export function pastilleNavigation(
  compte: number | null | undefined,
  options: OptionsPastille = {}
): PastilleNavigation | null {
  const { maximum = MAXIMUM_PAR_DEFAUT, ton = 'attention', seuilUrgent } = options

  if (typeof compte !== 'number' || !Number.isFinite(compte) || compte < 1) return null

  const entier = Math.floor(compte)
  if (entier < 1) return null

  const depasse = entier > maximum
  const tonRetenu: TonPastille = seuilUrgent !== undefined && entier >= seuilUrgent ? 'urgent' : ton

  return {
    texte: depasse ? `${maximum}+` : String(entier),
    ton: tonRetenu,
  }
}

/**
 * Le compte d'une entrée parente : la somme de ce que portent ses enfants.
 *
 * Une entrée repliée cache ses pastilles. Sans cumul, on n'apprend qu'en dépliant qu'il y avait
 * quelque chose à voir — ce qui vide la pastille de son intérêt, puisqu'elle sert justement à
 * éviter d'aller regarder.
 *
 * `null` quand aucun enfant n'a de compte, et non zéro : le parent n'affiche alors rien, comme
 * ses enfants. Un enfant sans compte ne compte pas pour zéro, il ne compte pas du tout — la
 * distinction importe quand un module n'a pas encore répondu.
 */
export function cumulerCompteurs(comptes: Array<number | null | undefined>): number | null {
  const connus = comptes.filter(
    (compte): compte is number => typeof compte === 'number' && Number.isFinite(compte)
  )
  if (connus.length === 0) return null
  return connus.reduce((total, compte) => total + Math.max(0, Math.floor(compte)), 0)
}

/**
 * Le nom de couleur Nuxt UI correspondant à un ton.
 *
 * La traduction se fait ici et non dans chaque appelant : changer la couleur de l'urgence doit
 * être une modification, pas une battue.
 */
export function couleurPastille(ton: TonPastille): 'neutral' | 'warning' | 'error' {
  switch (ton) {
    case 'urgent':
      return 'error'
    case 'attention':
      return 'warning'
    default:
      return 'neutral'
  }
}
