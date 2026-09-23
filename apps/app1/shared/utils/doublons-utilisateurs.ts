import { cleDeBoiteDeReception } from './adresse-email'

/**
 * Rapprocher les comptes qui semblent appartenir à une même personne.
 *
 * `email` et `pseudo` sont uniques en base, et l'inscription passe l'adresse en minuscules : le
 * doublon EXACT n'existe pas, il n'y a rien à chercher de ce côté. Ce module cherche donc des
 * doublons APPROCHANTS, selon quatre motifs de fiabilité décroissante, chacun nommé dans le
 * résultat — c'est le motif qui permet à l'administrateur de juger sans rouvrir les fiches.
 *
 * Aucune fusion, aucune suppression : ce module CONSTATE. Il ne touche pas aux données.
 *
 * Fonctions pures, testables sur des tableaux : ce sont les règles qui peuvent se tromper, pas
 * la requête qui les alimente.
 */

export type MotifDeRapprochement = 'boite' | 'identite' | 'telephone' | 'pseudo'

export interface CompteAComparer {
  id: number
  email: string
  pseudo: string
  nom?: string | null
  prenom?: string | null
  phone?: string | null
}

export interface GrappeDeDoublons {
  motif: MotifDeRapprochement
  /** La valeur commune qui a provoqué le rapprochement, telle qu'on peut l'afficher. */
  cle: string
  /** Les identifiants des comptes rapprochés, dans l'ordre où ils sont arrivés. */
  comptes: number[]
  /**
   * Vrai quand la grappe est trop nombreuse pour désigner une personne.
   *
   * Mesuré, pas supposé : en base de développement, `+33600000000` est partagé par 17 comptes et
   * `00000000` par 7 — ce sont des numéros bouche-trou, pas une même personne. Le même effet
   * existe sur les pseudos engendrés par un motif commun. Ces grappes ne sont pas CACHÉES — les
   * taire ferait disparaître une information réelle — mais signalées, pour qu'elles ne noient pas
   * les paires qui, elles, méritent un regard.
   */
  suspecte: boolean
}

/**
 * Au-delà de ce nombre, une grappe cesse de décrire une personne.
 *
 * Quatre et non deux : un même individu peut légitimement s'être créé trois comptes, et il arrive
 * qu'un couple partage un téléphone. Au-delà, c'est une valeur par défaut ou un motif de nommage.
 */
export const TAILLE_DE_GRAPPE_SUSPECTE = 4

/** Minuscules, sans accents, sans espaces superflus. */
function sansAccentNiCasse(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * L'identité civile, quand elle est renseignée des deux côtés.
 *
 * Un nom seul ne suffit pas : trop d'homonymes. Un prénom seul encore moins.
 */
export function cleIdentiteCivile(
  nom: string | null | undefined,
  prenom: string | null | undefined
): string | null {
  const n = sansAccentNiCasse(nom ?? '').replace(/\s+/g, ' ')
  const p = sansAccentNiCasse(prenom ?? '').replace(/\s+/g, ' ')
  if (!n || !p) return null
  return `${p} ${n}`
}

/**
 * Le numéro réduit à ses chiffres, ou `null` s'il ne peut rien désigner.
 *
 * Deux écritures d'un même numéro — `+33 6 12 34 56 78` et `0612345678` — doivent se rejoindre,
 * d'où le préfixe international ramené au `0` national. Les numéros trop courts et ceux dont tous
 * les chiffres sont identiques sont écartés : ce sont des remplissages, pas des coordonnées.
 */
export function cleTelephone(phone: string | null | undefined): string | null {
  const chiffres = (phone ?? '').replace(/\D/g, '')
  if (chiffres.length < 8) return null
  if (/^(\d)\1*$/.test(chiffres)) return null

  // Les six derniers chiffres suffisent à rapprocher deux écritures d'un même numéro sans
  // dépendre du pays ; on garde davantage pour ne pas confondre deux numéros voisins.
  return chiffres.slice(-9)
}

/**
 * Le pseudo réduit à ce qui ne varie pas d'un compte à l'autre de la même personne.
 *
 * Mesuré sur la base de développement : cette seule règle rapproche `Adrien` et `adrien.1`,
 * `Lulu` et `Lulu84`, `Jo Ris` et `Joris`, `romain_noel_1787647383299` et `romainnoel`. Séparateurs
 * et chiffres de fin sont précisément ce qu'on ajoute quand le pseudo voulu est déjà pris.
 *
 * Un regroupement par clé, et non une distance de similarité : la règle se lit, s'explique à qui
 * consulte l'écran, et ne demande pas de comparer chaque compte à tous les autres.
 */
export function clePseudo(pseudo: string | null | undefined): string | null {
  const reduit = sansAccentNiCasse(pseudo ?? '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/[0-9]+$/, '')
  // Deux lettres ne suffisent pas à affirmer quoi que ce soit.
  return reduit.length >= 3 ? reduit : null
}

/** La clé d'un compte pour un motif donné, ou `null` s'il n'entre pas dans ce rapprochement. */
function cleSelonLeMotif(compte: CompteAComparer, motif: MotifDeRapprochement): string | null {
  switch (motif) {
    case 'boite':
      return cleDeBoiteDeReception(compte.email)
    case 'identite':
      return cleIdentiteCivile(compte.nom, compte.prenom)
    case 'telephone':
      return cleTelephone(compte.phone)
    case 'pseudo':
      return clePseudo(compte.pseudo)
  }
}

/** L'ordre d'affichage : du motif le plus sûr au plus bavard. */
export const MOTIFS_PAR_FIABILITE: readonly MotifDeRapprochement[] = [
  'boite',
  'identite',
  'telephone',
  'pseudo',
]

/**
 * Les grappes de comptes rapprochés, tous motifs confondus.
 *
 * Triées par motif — le plus sûr d'abord — puis par taille croissante : une paire est presque
 * toujours un vrai doublon, une grappe de vingt presque jamais.
 *
 * Un même compte peut apparaître sous plusieurs motifs, et c'est voulu : deux comptes rapprochés
 * à la fois par le nom et par le pseudo sont un candidat plus fort que par un seul des deux.
 */
export function chercherLesDoublons(comptes: CompteAComparer[]): GrappeDeDoublons[] {
  const grappes: GrappeDeDoublons[] = []

  for (const motif of MOTIFS_PAR_FIABILITE) {
    const parCle = new Map<string, number[]>()

    for (const compte of comptes) {
      const cle = cleSelonLeMotif(compte, motif)
      if (!cle) continue
      const existante = parCle.get(cle)
      if (existante) existante.push(compte.id)
      else parCle.set(cle, [compte.id])
    }

    for (const [cle, ids] of parCle) {
      if (ids.length < 2) continue
      grappes.push({
        motif,
        cle,
        comptes: ids,
        suspecte: ids.length > TAILLE_DE_GRAPPE_SUSPECTE,
      })
    }
  }

  return grappes.sort((a, b) => {
    const rang = MOTIFS_PAR_FIABILITE.indexOf(a.motif) - MOTIFS_PAR_FIABILITE.indexOf(b.motif)
    if (rang !== 0) return rang
    if (a.comptes.length !== b.comptes.length) return a.comptes.length - b.comptes.length
    return a.cle.localeCompare(b.cle)
  })
}

/**
 * Les fragments à chercher dans la colonne `phone`, tirés d'une saisie libre.
 *
 * Mesuré en base : sur 201 numéros renseignés, 144 sont stockés au format international
 * (« +33616810413 ») et 54 en chiffres seuls. Un administrateur, lui, tape ce qu'il a sous les
 * yeux — le numéro entier, ou seulement ce dont il se souvient.
 *
 * Mesuré aussi, en jouant les cas réels : chercher « 8104 » ou « 616810 » trouvait déjà, par la
 * recherche mot à mot. Deux saisies échouaient, et ce sont les deux que cette fonction règle :
 *
 * - « 0616810413 », le numéro national entier, absent tel quel d'un « +33616810413 » ;
 * - « 0616 8104 », un fragment qui commence par le zéro national.
 *
 * Dans les deux cas, c'est le PRÉFIXE qui diffère, jamais le numéro. On propose donc plusieurs
 * écritures du même fragment, à chercher en alternative : telle que tapée, sans le zéro de tête,
 * et réduite aux neuf derniers chiffres quand la saisie est assez longue pour en porter autant.
 *
 * Trois chiffres au minimum : en deçà, la recherche ramènerait presque tout le fichier.
 *
 * ⚠️ Reste hors de portée : les numéros stockés AVEC séparateurs, qu'aucune de ces écritures ne
 * peut atteindre sans réécrire la colonne côté base. Ils sont 3 sur 201.
 */
export function fragmentsDeTelephone(saisie: string | null | undefined): string[] {
  const chiffres = (saisie ?? '').replace(/\D/g, '')
  if (chiffres.length < 3) return []

  const fragments = new Set<string>([chiffres])
  if (chiffres.length >= 9) fragments.add(chiffres.slice(-9))
  if (chiffres.startsWith('0') && chiffres.length > 3) fragments.add(chiffres.slice(1))

  return [...fragments]
}
