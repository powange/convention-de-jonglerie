/**
 * Combien de personnes sont sur place, quand, et à quel titre.
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
 * Il ne lit pas la base : il reçoit des présences déjà résolues. C'est ce qui permet de le couvrir
 * sans base ni réseau, alors qu'un total d'affluence faux reste un nombre parfaitement plausible.
 *
 * ⚠️ N'importe rien d'autre que ses voisins de `shared/` : il est chargé tel quel par les tests
 * unitaires, hors Nuxt.
 */

import type { FenetrePresence } from './presence-benevole'

/**
 * Les quatre populations du graphique, **dans l'ordre de priorité**.
 *
 * Cet ordre n'est pas décoratif : c'est lui qui décide dans quelle pile tombe une personne présente
 * à deux titres. Choix de l'utilisateur — « le rôle engagé d'abord » : quelqu'un qui a un billet ET
 * tient des créneaux est sur place comme bénévole, et le compter en participant sous-estimerait
 * l'équipe, qui est le chiffre dont on se sert pour organiser.
 *
 * Mesuré sur l'édition 1 de la base de développement : 10 personnes sur 191 portent deux titres, 8
 * billet + bénévole et 2 billet + artiste. Aucune n'en porte trois — l'ordre complet est donc
 * surtout une précaution pour demain.
 */
export const POPULATIONS_AFFLUENCE = [
  'organisateurs',
  'artistes',
  'benevoles',
  'participants',
] as const

export type PopulationAffluence = (typeof POPULATIONS_AFFLUENCE)[number]

/** Un titre à être là : une ligne du journal, résolue par l'appelant. */
export interface PresenceDeclaree {
  /**
   * Ce qui fait qu'une personne est UNE personne : son adresse de courriel, et à défaut une clé
   * technique préfixée par sa famille.
   *
   * C'est ici que se joue le « personnes physiques » demandé. Sans ce rapprochement, l'affluence est
   * surévaluée de 30 % sur l'édition 1 de la base de développement — 274 entrées pour 191 personnes.
   */
  identite: string
  population: PopulationAffluence
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

/** Une personne, une fois ses titres réunis. */
export interface PersonnePresente {
  identite: string
  /** La population retenue : la plus engagée de ses titres. */
  population: PopulationAffluence
  debut: number
  /** `null` : présente jusqu'au bout. */
  fin: number | null
}

/** Une tranche de temps, bornes en millisecondes. `fin` est exclue. */
export interface Tranche {
  debut: number
  fin: number
}

/**
 * La présence effective d'un titre : ce que l'entrée et la fenêtre disent ensemble.
 *
 * Le début est le PLUS TARDIF des deux — l'entrée validée et le début déclaré. C'est la règle que
 * l'utilisateur a énoncée pour les participants, et elle vaut pour tous : « si le billet a été
 * validé avant même que le tarif ne commence, il faut prendre la date où le tarif commence ». Dans
 * l'autre sens, quelqu'un qui arrive après le début prévu n'était pas là avant.
 */
export function presenceEffective(presence: PresenceDeclaree): {
  debut: number
  fin: number | null
} {
  const { entree, fenetre } = presence
  return {
    debut: fenetre.arrivee !== null ? Math.max(entree, fenetre.arrivee) : entree,
    fin: fenetre.depart,
  }
}

/**
 * Réunit les titres d'une même personne en une seule présence.
 *
 * Deux règles, et la seconde est moins évidente que la première :
 *
 * 1. **la population retenue est la plus engagée** (voir `POPULATIONS_AFFLUENCE`) ;
 * 2. **la fenêtre est l'UNION** de celles de ses titres. Un bénévole qui a aussi un pass week-end
 *    est sur place tant que l'un des deux le dit : ne garder que la fenêtre du titre gagnant le
 *    ferait disparaître du vendredi parce qu'il ne tient de créneau que le samedi. Il est bien là,
 *    et il y est comme bénévole.
 */
export function reunirLesTitres(presences: readonly PresenceDeclaree[]): PersonnePresente[] {
  const parPersonne = new Map<string, PersonnePresente>()

  for (const presence of presences) {
    const { debut, fin } = presenceEffective(presence)
    const connue = parPersonne.get(presence.identite)

    if (!connue) {
      parPersonne.set(presence.identite, {
        identite: presence.identite,
        population: presence.population,
        debut,
        fin,
      })
      continue
    }

    if (
      POPULATIONS_AFFLUENCE.indexOf(presence.population) <
      POPULATIONS_AFFLUENCE.indexOf(connue.population)
    ) {
      connue.population = presence.population
    }

    connue.debut = Math.min(connue.debut, debut)
    // `null` gagne : une fenêtre sans fin ne se referme pas, donc l'union non plus.
    connue.fin = connue.fin === null || fin === null ? null : Math.max(connue.fin, fin)
  }

  return [...parPersonne.values()]
}

/**
 * Cette personne est-elle présente pendant cette tranche ?
 *
 * **Par recouvrement**, et non « à l'instant qui ouvre la tranche ». La nuance décide de tout dès
 * que la granularité est large : quelqu'un qui arrive samedi 10 h n'est pas présent à minuit, mais
 * il l'est bien ce samedi-là — le compter hors de la tranche du jour serait absurde.
 */
export function estPresenteDansLaTranche(personne: PersonnePresente, tranche: Tranche): boolean {
  if (personne.debut >= tranche.fin) return false
  if (personne.fin !== null && personne.fin <= tranche.debut) return false
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

/** Ce que le graphique trace : une série par population, et leur total. */
export interface AffluenceParPopulation {
  total: number[]
  parPopulation: Record<PopulationAffluence, number[]>
}

/**
 * Le nombre de personnes présentes dans chaque tranche, par population.
 *
 * Les quatre séries **s'additionnent exactement au total**, parce que chaque personne n'appartient
 * qu'à une population : c'est ce qui autorise à les empiler. Une répartition où quelqu'un
 * compterait deux fois ferait une pile plus haute que le nombre de gens sur le site, et l'échelle
 * du graphique mentirait.
 */
export function compterAffluence(
  personnes: readonly PersonnePresente[],
  tranches: readonly Tranche[]
): AffluenceParPopulation {
  const parPopulation = Object.fromEntries(
    POPULATIONS_AFFLUENCE.map((population) => [population, [] as number[]])
  ) as Record<PopulationAffluence, number[]>
  const total: number[] = []

  for (const tranche of tranches) {
    const comptes = Object.fromEntries(
      POPULATIONS_AFFLUENCE.map((population) => [population, 0])
    ) as Record<PopulationAffluence, number>
    let somme = 0

    for (const personne of personnes) {
      if (!estPresenteDansLaTranche(personne, tranche)) continue
      comptes[personne.population] += 1
      somme += 1
    }

    for (const population of POPULATIONS_AFFLUENCE) {
      parPopulation[population].push(comptes[population])
    }
    total.push(somme)
  }

  return { total, parPopulation }
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
