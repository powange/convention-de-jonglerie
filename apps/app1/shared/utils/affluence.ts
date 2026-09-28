/**
 * Combien de personnes sont sur place, et quand.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le graphique voisin compte des ARRIVÉES par tranche : un flux. Celui-ci compte des PRÉSENCES à un
 * instant : un stock. La différence est entière, et elle a une conséquence qu'il faut connaître —
 * **aucune sortie n'est enregistrée**. Le journal des entrées ne connaît que `VALIDATED` et
 * `INVALIDATED`, et le second est une correction d'entrée, pas un départ.
 *
 * La présence se déduit donc de deux choses : l'entrée réellement validée, qui donne le début, et
 * une fenêtre DÉCLARÉE, qui donne la fin. Pour un billet, c'est la fenêtre du tarif ; pour un
 * bénévole ou un organisateur, ses dates d'arrivée et de départ ; pour un artiste, les siennes.
 * C'est ce qui fait redescendre la courbe.
 *
 * ## Ce que ce fichier ne fait pas
 *
 * Il ne lit pas la base : il reçoit des participants déjà résolus. C'est ce qui permet de le couvrir
 * sans base ni réseau, alors qu'un total d'affluence faux reste un nombre parfaitement plausible.
 *
 * ⚠️ N'importe rien d'autre que ses voisins de `shared/` : il est chargé tel quel par les tests
 * unitaires, hors Nuxt.
 */

import type { FenetrePresence } from './presence-benevole'

/** Une personne présente, telle que l'appelant l'a résolue depuis la base. */
export interface ParticipantPresent {
  /**
   * Ce qui fait qu'une personne est UNE personne : son compte quand elle en a un, son adresse de
   * courriel sinon, et en dernier recours sa clé technique.
   *
   * C'est ici que se joue le « personnes physiques » demandé : deux lignes de journal qui portent
   * la même identité — un bénévole qui a aussi acheté un billet — ne comptent qu'une fois. Sans
   * cela, l'affluence est surévaluée de 43 % sur l'édition 1 de la base de développement (274
   * entrées pour 191 personnes).
   */
  identite: string
  /**
   * L'instant de l'entrée validée, en millisecondes.
   *
   * Le début réel de la présence, quoi qu'en dise la fenêtre : un billet dont le tarif annonce
   * vendredi, validé le samedi, n'était pas là vendredi.
   */
  entree: number
  /**
   * La fin déclarée, et une éventuelle arrivée déclarée plus tardive que l'entrée.
   *
   * `null` à une borne veut dire « sans limite », comme pour les bénévoles.
   */
  fenetre: FenetrePresence
}

/** Une tranche de temps, bornes en millisecondes. `fin` est exclue. */
export interface Tranche {
  debut: number
  fin: number
}

/**
 * La présence effective d'un participant : ce que l'entrée et la fenêtre disent ensemble.
 *
 * L'arrivée est la PLUS TARDIVE des deux — l'entrée validée et l'arrivée déclarée. Prendre la plus
 * précoce ferait compter quelqu'un avant qu'il ne soit là, sur la seule foi d'une déclaration.
 */
export function presenceEffective(participant: ParticipantPresent): {
  debut: number
  fin: number | null
} {
  const { entree, fenetre } = participant
  return {
    debut: fenetre.arrivee !== null ? Math.max(entree, fenetre.arrivee) : entree,
    fin: fenetre.depart,
  }
}

/**
 * Le participant est-il présent pendant cette tranche ?
 *
 * **Par recouvrement**, et non « à l'instant qui ouvre la tranche ». La nuance décide de tout dès
 * que la granularité est large : quelqu'un qui arrive samedi 10 h n'est pas présent à minuit, mais
 * il l'est bien ce samedi-là — le compter hors de la tranche du jour serait absurde.
 *
 * Une fenêtre sans fin ne se referme jamais : c'est le cas d'une donnée non déclarée, et l'appelant
 * est censé lui avoir donné un repli avant d'arriver ici.
 */
export function estPresentDansLaTranche(
  participant: ParticipantPresent,
  tranche: Tranche
): boolean {
  const { debut, fin } = presenceEffective(participant)

  if (debut >= tranche.fin) return false
  if (fin !== null && fin <= tranche.debut) return false
  return true
}

/**
 * Les tranches délimitées par une suite de bornes.
 *
 * Les bornes sont calculées par l'APPELANT, qui seul connaît le fuseau de l'édition, et c'est une
 * précaution et non une commodité : découper par pas fixe ferait qu'une tranche « d'un jour »
 * cesserait de commencer à minuit sur place dès le dimanche d'un changement d'heure — elle
 * dériverait d'une heure et toutes les suivantes avec elle. Luxon sait ajouter un jour civil ;
 * `t += 86_400_000` ne le sait pas.
 *
 * Une borne unique ne délimite aucune tranche : il en faut deux pour faire un intervalle.
 */
export function tranchesDepuisBornes(bornes: readonly number[]): Tranche[] {
  const tranches: Tranche[] = []

  for (let i = 0; i + 1 < bornes.length; i += 1) {
    const debut = bornes[i]!
    const fin = bornes[i + 1]!
    // Une borne qui ne progresse pas ne fait pas une tranche : elle ferait une case de largeur nulle
    // dans laquelle personne ne serait jamais compté.
    if (fin > debut) tranches.push({ debut, fin })
  }

  return tranches
}

/**
 * Le nombre de PERSONNES présentes dans chaque tranche.
 *
 * Une seule série, volontairement : pas de répartition par population. Une personne qui est là à
 * deux titres — bénévole et détentrice d'un billet — devrait sinon être attribuée à l'une des deux,
 * et toute règle d'attribution serait une invention. La répartition par population existe déjà sur
 * le graphique des arrivées, où chaque entrée compte pour elle-même.
 */
export function compterAffluence(
  participants: readonly ParticipantPresent[],
  tranches: readonly Tranche[]
): number[] {
  return tranches.map((tranche) => {
    const presentes = new Set<string>()

    for (const participant of participants) {
      if (estPresentDansLaTranche(participant, tranche)) presentes.add(participant.identite)
    }

    return presentes.size
  })
}

/**
 * Le sommet de la courbe, et quand il a eu lieu.
 *
 * Rendu par le serveur plutôt que recalculé à l'écran : c'est le chiffre qu'un organisateur cherche
 * en premier — « combien de monde au plus fort ? » — et le déduire d'un tableau de valeurs côté
 * client donnerait deux endroits où le calculer.
 */
export function sommetDeLAffluence(
  valeurs: readonly number[],
  tranches: readonly Tranche[]
): { valeur: number; debut: number | null } {
  let valeur = 0
  let index = -1

  valeurs.forEach((v, i) => {
    if (v > valeur) {
      valeur = v
      index = i
    }
  })

  return { valeur, debut: index >= 0 ? (tranches[index]?.debut ?? null) : null }
}
