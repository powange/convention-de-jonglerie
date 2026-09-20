import {
  alignerSurAxe,
  axeCommun,
  creneauDepuisOuverture,
  etiquettesDeCreneaux,
} from '~~/shared/utils/recalage-editions'

/**
 * Superposer les statistiques de deux éditions.
 *
 * Les graphiques de cet écran portent des dates réelles, ce qui est juste tant qu'on regarde une
 * seule édition. Dès qu'on en compare deux, les dates cessent d'avoir un sens commun : l'une
 * s'est tenue en avril, l'autre en mai, et les courbes ne se rencontreraient jamais.
 *
 * Ce fichier ne dessine rien. Il décide de ce que l'axe porte et de la façon dont les deux séries
 * s'y posent — c'est-à-dire de ce que le lecteur va comparer. Les composants de graphique n'ont
 * plus qu'à tracer ce qu'il rend, et cette règle-ci est testable sans monter un écran.
 */

/** Une édition, réduite à ce dont la comparaison a besoin. */
export interface SerieDEdition {
  /** Les instants de début de chaque tranche, tels que le serveur les rend. */
  timestamps: readonly string[]
  /** Les séries numériques, par nom — « participants », « volunteers »… */
  series: Readonly<Record<string, readonly number[]>>
  /** Le premier jour de l'édition : c'est lui qui donne son origine à l'axe. */
  ouverture: string | Date | null | undefined
  /** Le fuseau du lieu, pour que les jours soient ceux vécus sur place. */
  fuseau?: string | null
}

/** Deux éditions posées sur un axe commun. */
export interface ComparaisonDeSeries {
  /** Les repères, prêts à s'afficher : « J-30 », « J-1 », « J1 »… */
  etiquettes: string[]
  /** L'édition courante, alignée — `null` là où elle n'a pas de valeur. */
  courante: Record<string, (number | null)[]>
  /** L'édition comparée, alignée sur le même axe. */
  comparee: Record<string, (number | null)[]>
}

/**
 * Aligne deux éditions sur un axe de jours relatifs à leur propre ouverture.
 *
 * Les noms de séries retenus sont ceux de l'édition COURANTE : c'est elle qu'on regarde, et une
 * série que l'édition passée serait seule à porter n'aurait rien à quoi se comparer. Une série
 * absente de l'édition passée est rendue entièrement vide plutôt qu'omise, pour que les deux
 * objets aient toujours les mêmes clés — un appelant qui boucle dessus ne doit pas avoir à
 * vérifier l'existence de chaque entrée.
 */
export function comparerSeries(
  courante: SerieDEdition,
  comparee: SerieDEdition,
  granulariteMinutes: number
): ComparaisonDeSeries {
  // L'alignement se fait au CRÉNEAU, à la finesse que l'écran affiche. Une première version
  // raisonnait au jour et repliait toutes les tranches d'une journée sur un point : le graphique
  // cessait alors de répondre au réglage de granularité.
  const reperesCourants = courante.timestamps.map((t) =>
    creneauDepuisOuverture(t, courante.ouverture, granulariteMinutes, courante.fuseau ?? undefined)
  )
  const reperesCompares = comparee.timestamps.map((t) =>
    creneauDepuisOuverture(t, comparee.ouverture, granulariteMinutes, comparee.fuseau ?? undefined)
  )

  const axe = axeCommun(
    reperesCourants.filter((r): r is number => r !== null),
    reperesCompares.filter((r): r is number => r !== null)
  )

  const resultatCourant: Record<string, (number | null)[]> = {}
  const resultatCompare: Record<string, (number | null)[]> = {}

  for (const nom of Object.keys(courante.series)) {
    resultatCourant[nom] = alignerSurAxe(axe, reperesCourants, courante.series[nom] ?? [])
    resultatCompare[nom] = alignerSurAxe(axe, reperesCompares, comparee.series[nom] ?? [])
  }

  return {
    // Le jour n'étiquette plus que la PREMIÈRE colonne de chaque journée : à douze heures de
    // granularité, « J-1 » couvre ses deux colonnes sans se répéter sous chacune.
    etiquettes: etiquettesDeCreneaux(axe, granulariteMinutes),
    courante: resultatCourant,
    comparee: resultatCompare,
  }
}

/**
 * Le libellé court d'une édition, pour la légende d'un graphique.
 *
 * Deux éditions d'une même convention portent souvent le même nom : seule l'année les distingue,
 * et c'est elle qu'on lit dans une légende. Le nom propre prime quand il existe, parce qu'une
 * convention qui nomme ses éditions le fait justement pour les distinguer.
 */
export function libelleDEdition(
  nom: string | null | undefined,
  debut: string | Date | null | undefined
): string {
  const propre = (nom ?? '').trim()
  if (propre.length > 0) return propre
  const date = debut instanceof Date ? debut : debut ? new Date(debut) : null
  if (date === null || Number.isNaN(date.getTime())) return ''
  return String(date.getFullYear())
}
