/**
 * Le bénévolat d'une édition est-il encore d'actualité ?
 *
 * L'ouverture des candidatures était un booléen — `open` — qu'un organisateur devait penser à
 * rebasculer. Personne n'y pense la veille du montage : une édition recrute pendant le montage,
 * pendant l'événement et pendant le démontage, et c'est très bien ainsi. Ce qui n'a plus de sens,
 * c'est de recruter pour une édition dont le démontage est fini.
 *
 * La règle ferme donc les candidatures **et retire la page publique** une fois cette date passée.
 * Les deux ensemble, et c'est délibéré : une page encore offerte aux visiteurs qui n'accepte plus
 * de candidature est une invitation à un formulaire qui refusera.
 *
 * Ce que la règle ne touche pas : ceux qui ont le droit de gérer l'édition, et ceux qui y ont
 * candidaté. `droitsSurLaConfiguration` leur ouvre la porte à d'autres titres que `pagePublic`,
 * si bien qu'un bénévole garde accès à ce qu'il a lui-même rempli, et un organisateur à son
 * écran de gestion. Ce qui disparaît, c'est la vitrine.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La situation d'une édition, réduite à ce dont la règle a besoin. */
export interface SituationDuBenevolat {
  /** Le booléen que l'organisateur bascule à la main. */
  open: boolean
  /** La page de bénévolat est-elle offerte aux visiteurs ? */
  pagePublic: boolean
  /** Fin du démontage, quand l'édition en a déclaré une. */
  finDemontage?: Date | string | null
  /** Fin de l'édition elle-même — ce qui sert de repère quand aucun démontage n'est déclaré. */
  finEdition?: Date | string | null
  /**
   * L'instant de référence.
   *
   * Passé explicitement plutôt que lu ici : un test qui dépend de l'heure courante ne prouve rien,
   * et il finit par échouer un jour de janvier sans que personne ne comprenne pourquoi.
   */
  maintenant: Date
}

/** Ce que l'édition laisse voir, une fois la règle appliquée. */
export interface VisibiliteDuBenevolat {
  /** Les candidatures sont-elles acceptées ? */
  open: boolean
  /** La page de bénévolat est-elle visible d'un simple visiteur ? */
  pagePublic: boolean
  /** L'édition est-elle derrière nous, démontage compris ? */
  terminee: boolean
}

/** Une date lisible, ou `null` — une chaîne vide et une date invalide valent une absence. */
function enDate(valeur: Date | string | null | undefined): Date | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const date = valeur instanceof Date ? new Date(valeur.getTime()) : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * L'instant après lequel le bénévolat d'une édition n'a plus d'objet, ou `null` si rien ne le date.
 *
 * Deux précautions, l'une et l'autre apprises ailleurs dans ce module :
 *
 * 1. **Le dernier jour compte en entier.** Ces dates sont saisies par un calendrier et stockées à
 *    minuit ; s'arrêter à minuit fermerait tout un jour trop tôt. Le contrôle de période des
 *    créneaux (`volunteer-time-slots/index.post.ts`) ajoute déjà ce jour pour la même raison, et
 *    la borne calculée ici est la même que la sienne.
 * 2. **On retient la plus tardive des deux dates.** Un démontage saisi *avant* la fin de l'édition
 *    est une erreur de saisie, pas une intention ; la prendre au mot fermerait le recrutement
 *    pendant l'événement. Se tromper dans ce sens-là coûte une page qui reste ouverte quelques
 *    jours de trop, ce qui se corrige d'un clic — l'inverse coûte des bénévoles.
 */
export function finDuBenevolat(situation: SituationDuBenevolat): Date | null {
  const candidates = [enDate(situation.finDemontage), enDate(situation.finEdition)].filter(
    (d): d is Date => d !== null
  )
  if (candidates.length === 0) return null

  const derniere = candidates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
  const borne = new Date(derniere.getTime())
  borne.setDate(borne.getDate() + 1)
  return borne
}

/**
 * Ce que l'édition laisse voir à l'instant donné.
 *
 * Une édition qu'aucune date ne situe reste gouvernée par les seuls booléens : on ne ferme pas ce
 * qu'on ne sait pas dater. C'est le cas d'une édition en cours de création, et lui appliquer une
 * fermeture reviendrait à décider à la place de l'organisateur sur la foi d'une absence.
 */
export function visibiliteDuBenevolat(situation: SituationDuBenevolat): VisibiliteDuBenevolat {
  const fin = finDuBenevolat(situation)
  const terminee = fin !== null && situation.maintenant.getTime() >= fin.getTime()

  return {
    open: situation.open && !terminee,
    pagePublic: situation.pagePublic && !terminee,
    terminee,
  }
}
