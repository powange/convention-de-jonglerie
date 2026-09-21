import {
  etatEmprunt,
  prochaineEtapeEmprunt,
  type EmpruntObservable,
  type ResponsableEmprunt,
} from './etat-emprunt'

/**
 * L'ordre dans lequel on lit les emprunts, et la façon dont on les regroupe.
 *
 * Le tableau de bord répond à une question pratique : qu'est-ce qui me tombe dessus en premier ?
 * L'ordre est donc la réponse, pas une commodité — et il ne peut pas se décider côté base, où
 * l'état d'un emprunt n'est pas une colonne mais un calcul.
 *
 * Sorti de l'écran parce que c'est une règle, et que l'écran demande une session d'organisateur
 * qu'un test ne peut pas obtenir.
 */

/**
 * Les états que le tableau donne à voir, dans l'ordre où ils pressent.
 *
 * Le matériel rendu ferme la marche : il n'attend plus rien, mais il reste consultable — une
 * fausse manœuvre se corrige, et il faut pouvoir retrouver ce qu'on a marqué rendu par erreur.
 */
export const ETATS_TABLEAU = ['en_retard', 'a_recuperer', 'a_rendre', 'rendu'] as const
export type EtatTableau = (typeof ETATS_TABLEAU)[number]

/** Un groupe d'emprunts partageant le même état. */
export interface GroupeEmprunts<T> {
  etat: EtatTableau
  emprunts: T[]
}

/** Le rang d'une échéance : plus il est petit, plus ça presse. */
function rangEcheance(echeance: string | Date | null | undefined): number {
  if (!echeance) return Number.POSITIVE_INFINITY
  const instant = new Date(echeance).getTime()
  // Une date illisible ne doit pas remonter en tête : elle rejoint les emprunts sans échéance.
  return Number.isNaN(instant) ? Number.POSITIVE_INFINITY : instant
}

/**
 * Les emprunts du plus pressant au moins pressant.
 *
 * L'échéance la plus proche d'abord ; ceux qui n'en ont pas ferment la marche, faute de quoi ils
 * occuperaient la tête de liste en MySQL, où l'absence de valeur passe avant tout le reste. À
 * échéance égale, l'ordre alphabétique, pour qu'un rechargement ne rebatte pas les cartes.
 */
export function ordonnerEmprunts<T extends { name: string; returnDueAt?: string | Date | null }>(
  emprunts: T[]
): T[] {
  return [...emprunts].sort((a, b) => {
    const ecart = rangEcheance(a.returnDueAt) - rangEcheance(b.returnDueAt)
    if (ecart !== 0) return ecart
    return a.name.localeCompare(b.name, 'fr')
  })
}

/**
 * Les emprunts répartis par état, dans l'ordre où ils se traitent.
 *
 * Le retard d'abord : c'est ce qui coûte, et c'est la seule raison d'ouvrir cette page en
 * urgence. Puis ce qu'il faut aller chercher — sans quoi rien ne commence —, puis ce qu'il faut
 * rapporter.
 *
 * Un groupe vide est écarté : un titre suivi de rien donne à croire qu'on a manqué quelque chose.
 * Le matériel rendu vient en dernier : il n'attend plus rien, mais il reste consultable pour qu'une
 * fausse manœuvre se corrige.
 */
export function grouperEmpruntsParEtat<
  T extends EmpruntObservable & { name: string; returnDueAt?: string | Date | null },
>(emprunts: T[], maintenant: Date = new Date()): GroupeEmprunts<T>[] {
  const groupes: GroupeEmprunts<T>[] = []

  for (const etat of ETATS_TABLEAU) {
    const retenus = emprunts.filter((emprunt) => etatEmprunt(emprunt, maintenant)?.cle === etat)
    if (retenus.length > 0) groupes.push({ etat, emprunts: ordonnerEmprunts(retenus) })
  }

  return groupes
}

/** Un emprunt accompagné de son état, tel qu'une ligne de tableau le porte. */
export type LigneEmprunt<T> = T & { etatTableau: EtatTableau }

/**
 * Les emprunts en une seule liste, du plus pressant au moins pressant.
 *
 * Le regroupement par état reste la règle qui ordonne — le retard d'abord, puis ce qu'il faut
 * aller chercher, puis ce qu'il faut rapporter —, mais un tableau se lit d'un bloc : trois
 * tableaux séparés interdiraient de trier sur une colonne, qui est justement ce qu'on vient y
 * faire. L'état devient donc une colonne, et l'ordre initial dit la priorité.
 */
export function lignesEmprunts<
  T extends EmpruntObservable & { name: string; returnDueAt?: string | Date | null },
>(emprunts: T[], maintenant: Date = new Date()): LigneEmprunt<T>[] {
  return grouperEmpruntsParEtat(emprunts, maintenant).flatMap((groupe) =>
    groupe.emprunts.map((emprunt) => ({ ...emprunt, etatTableau: groupe.etat }))
  )
}

/** Les deux moments d'un emprunt, tels que les onglets les séparent. */
export const ONGLETS_EMPRUNTS = ['a_recuperer', 'a_rendre', 'rendu'] as const
export type OngletEmprunts = (typeof ONGLETS_EMPRUNTS)[number]

/**
 * Les états qui relèvent de chaque onglet.
 *
 * « En retard » n'est pas un troisième moment : c'est un « à rendre » dont l'échéance est passée.
 * Lui donner son propre onglet séparerait deux lignes qui appellent le même geste — rapporter le
 * matériel —, et l'on aurait à regarder à deux endroits pour savoir ce qu'on doit rendre.
 */
const ETATS_PAR_ONGLET: Record<OngletEmprunts, readonly EtatTableau[]> = {
  a_recuperer: ['a_recuperer'],
  a_rendre: ['en_retard', 'a_rendre'],
  rendu: ['rendu'],
}

/** Les lignes d'un onglet, dans l'ordre de priorité. */
export function lignesOnglet<
  T extends EmpruntObservable & { name: string; returnDueAt?: string | Date | null },
>(emprunts: T[], onglet: OngletEmprunts, maintenant: Date = new Date()): LigneEmprunt<T>[] {
  const retenus = ETATS_PAR_ONGLET[onglet]
  return lignesEmprunts(emprunts, maintenant).filter((ligne) => retenus.includes(ligne.etatTableau))
}

/**
 * L'onglet à ouvrir en arrivant.
 *
 * Le retard d'abord : c'est la seule chose qui justifie d'ouvrir cette page en urgence, et elle
 * doit se voir sans qu'on cherche. À défaut, ce qu'il reste à aller chercher — sans quoi rien ne
 * commence. La règle est ici et non dans l'écran : c'est elle qui décide de ce qu'on voit en
 * premier.
 */
export function ongletParDefaut(
  emprunts: EmpruntObservable[],
  maintenant: Date = new Date()
): OngletEmprunts {
  return compterEmpruntsEnRetard(emprunts, maintenant) > 0 ? 'a_rendre' : 'a_recuperer'
}

/**
 * Ce qu'on peut faire depuis un onglet, et ce que cela écrit.
 *
 * Un onglet ne propose que les gestes de son moment : depuis « à récupérer », on ne peut que
 * marquer récupéré. Proposer les quatre partout obligerait à lire chaque bouton avant de cliquer,
 * et rendrait possible de marquer rendu du matériel qu'on n'est jamais allé chercher.
 *
 * Chaque onglet porte aussi son geste inverse, parce qu'une case se coche de travers : on annule
 * la récupération depuis « à rendre », le retour depuis « rendu ». Sans quoi il faudrait rouvrir
 * la fiche de chaque objet pour défaire une manipulation faite en lot.
 */
export interface ActionEmprunt {
  /** Clé de traduction du libellé du bouton. */
  cle: string
  /** Le jalon touché. */
  champ: 'pickedUpAt' | 'returnedAt'
  /** Vrai pour dater le jalon de maintenant, faux pour l'effacer. */
  pose: boolean
  /** Vrai pour le geste principal de l'onglet, qui se distingue à l'écran. */
  principale: boolean
}

const ACTIONS_PAR_ONGLET: Record<OngletEmprunts, readonly ActionEmprunt[]> = {
  a_recuperer: [
    {
      cle: 'gestion.stock.bulk_mark_picked_up',
      champ: 'pickedUpAt',
      pose: true,
      principale: true,
    },
  ],
  a_rendre: [
    { cle: 'gestion.stock.bulk_mark_returned', champ: 'returnedAt', pose: true, principale: true },
    {
      cle: 'gestion.stock.bulk_unmark_picked_up',
      champ: 'pickedUpAt',
      pose: false,
      principale: false,
    },
  ],
  rendu: [
    {
      cle: 'gestion.stock.bulk_unmark_returned',
      champ: 'returnedAt',
      pose: false,
      principale: true,
    },
  ],
}

export function actionsOnglet(onglet: OngletEmprunts): readonly ActionEmprunt[] {
  return ACTIONS_PAR_ONGLET[onglet]
}

/**
 * L'onglet porté par l'URL, ou `null` si elle n'en désigne aucun de valable.
 *
 * Une valeur inconnue — lien d'une version antérieure, adresse tapée à la main — est écartée
 * plutôt qu'appliquée : mieux vaut retomber sur l'onglet par défaut qu'afficher un tableau vide
 * sans expliquer pourquoi.
 */
export function ongletDepuisUrl(valeur: unknown): OngletEmprunts | null {
  if (typeof valeur !== 'string') return null
  return (ONGLETS_EMPRUNTS as readonly string[]).includes(valeur)
    ? (valeur as OngletEmprunts)
    : null
}

/** Ce dont on connaît la forme pour lire l'étape en cours d'un emprunt. */
type EmpruntAvecEtape = EmpruntObservable & {
  pickupLocation?: string | null
  pickupResponsible?: { pseudo: string } | null
  pickupContact?: string | null
  returnLocation?: string | null
  returnResponsible?: { pseudo: string } | null
  returnContact?: string | null
}

/** Les deux colonnes sur lesquelles on filtre : où aller, et qui s'en charge. */
export type ChampEtape = 'lieu' | 'qui'

/**
 * Les valeurs effectivement présentes dans une liste d'emprunts, pour un champ de l'étape.
 *
 * Une liste fermée et non une recherche par mot-clé : lieux et personnes sont saisis à la main, et
 * l'on ne retrouve pas « chez Marie, 12 rue des Lilas » en tapant « marie » si l'on a écrit
 * « Marie ». Proposer ce qui existe évite d'avoir à deviner l'orthographe de quelqu'un d'autre.
 *
 * La valeur retenue est celle de l'étape en cours — on va chercher là où c'est, on rapporte là où
 * c'est attendu —, donc la liste change d'un onglet à l'autre. C'est voulu : proposer un lieu de
 * retour dans l'onglet des récupérations ne rendrait rien.
 *
 * Pour « qui », comptes et texte libre se mêlent volontairement dans la même liste : du point de
 * vue de celui qui organise une tournée, Marie inscrite sur le site et « Marc, le voisin » sont
 * deux personnes, pas deux natures de données.
 */
export function valeursDEtape<T extends EmpruntAvecEtape>(
  emprunts: T[],
  champ: ChampEtape
): string[] {
  const valeurs = new Set<string>()
  for (const emprunt of emprunts) {
    const valeur = prochaineEtapeEmprunt(emprunt)?.[champ]?.trim()
    if (valeur) valeurs.add(valeur)
  }
  return [...valeurs].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Une personne du filtre : son nom, et son compte quand c'en est un. */
export interface PersonneDEtape {
  /** Ce qui s'affiche, et ce sur quoi on filtre. */
  valeur: string
  /** Le compte, ou `null` pour un nom écrit à la main. */
  compte: ResponsableEmprunt | null
}

/**
 * Les personnes de la liste, avec de quoi les montrer.
 *
 * Le filtre ne travaille que sur le nom — c'est ce que `filtrerParEtape` compare —, mais l'écran
 * a besoin de savoir si la personne est inscrite pour afficher son visage plutôt qu'une icône
 * générique. Deux informations pour une seule entrée, d'où cette forme plutôt qu'une liste de
 * chaînes.
 *
 * En cas d'homonymie entre un compte et un texte libre, le compte l'emporte : c'est la donnée la
 * plus sûre des deux, et la seule qui porte un visage.
 */
export function personnesDEtape<T extends EmpruntAvecEtape>(emprunts: T[]): PersonneDEtape[] {
  const parNom = new Map<string, PersonneDEtape>()

  for (const emprunt of emprunts) {
    const etape = prochaineEtapeEmprunt(emprunt)
    const valeur = etape?.qui?.trim()
    if (!valeur) continue

    const connue = parNom.get(valeur)
    if (!connue || (!connue.compte && etape?.compte)) {
      parNom.set(valeur, { valeur, compte: etape?.compte ?? null })
    }
  }

  return [...parNom.values()].sort((a, b) => a.valeur.localeCompare(b.valeur, 'fr'))
}

/**
 * Les emprunts dont l'étape porte cette valeur.
 *
 * Sans valeur choisie, rien n'est filtré — un filtre vide ne doit pas vider l'écran. La
 * comparaison est exacte : la valeur vient de la liste que `valeursDEtape` a construite, pas
 * d'une saisie.
 */
export function filtrerParEtape<T extends EmpruntAvecEtape>(
  emprunts: T[],
  champ: ChampEtape,
  valeur: string | null | undefined
): T[] {
  if (!valeur) return emprunts
  return emprunts.filter((emprunt) => prochaineEtapeEmprunt(emprunt)?.[champ]?.trim() === valeur)
}

/**
 * Combien d'emprunts sont en retard.
 *
 * C'est le nombre que porte la pastille du menu : le seul qui justifie d'interrompre ce qu'on
 * fait. Compter aussi ce qui est simplement à récupérer allumerait la pastille en permanence, dès
 * le premier emprunt convenu, et elle cesserait de vouloir dire quelque chose.
 */
export function compterEmpruntsEnRetard(
  emprunts: EmpruntObservable[],
  maintenant: Date = new Date()
): number {
  return emprunts.filter((emprunt) => etatEmprunt(emprunt, maintenant)?.cle === 'en_retard').length
}
