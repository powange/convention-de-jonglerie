/**
 * Ce qui part dans l'export PDF de la trésorerie, et comment c'est ordonné.
 *
 * Un PDF ne se rattrape pas : une fois envoyé au trésorier, au comptable ou à une assemblée
 * générale, il vit sa vie avec ses erreurs. Ce qui en sort se décide donc ici, dans un fichier
 * éprouvé par des tests, et non au fil de la mise en page — où une ligne oubliée ou un total faux
 * ne se voit qu'à la lecture, trop tard.
 *
 * Le regroupement par code d'imputation n'est pas un habillage : c'est à cela que sert un plan
 * comptable, et c'est le travail qu'on refait sinon à la main dans un tableur.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre que des types : il est chargé tel quel par les tests
 * unitaires, hors Nuxt.
 */

/** Une ligne de trésorerie, réduite à ce que l'export en lit. */
export interface LigneTresorerie {
  kind: 'EXPENSE' | 'INCOME'
  title: string
  code?: { code: string; label: string } | null
  /** Montant déjà payé, en centimes. */
  settled: number
  /** Montant engagé mais pas encore payé, en centimes. */
  pending: number
}

/**
 * Le code d'une ligne qui n'en a pas.
 *
 * Une chaîne vide plutôt qu'un libellé traduit : c'est une clé de regroupement, pas un texte
 * affiché. L'écran choisit ce qu'il en montre, et le tri ci-dessous s'en sert pour la placer en
 * dernier.
 */
export const SANS_CODE = ''

/**
 * Les lignes d'un même code, et ce qu'elles totalisent.
 *
 * Générique sur le type de ligne : l'appelant en sait plus que ce fichier — une ligne de la page
 * porte son origine, sa source, son identifiant —, et ce savoir doit traverser le regroupement
 * intact. Sans cela, la fonction qui compose les titres ne pourrait plus lire que ce que cet
 * util-ci déclare, et le typage refuserait à juste titre de lui promettre le reste.
 */
export interface GroupeDeCode<L extends LigneTresorerie = LigneTresorerie> {
  code: string
  /** Vide quand les lignes n'ont pas de code : c'est à l'écran de dire « Sans code ». */
  libelle: string
  lignes: L[]
  /** Sous-total réglé, en centimes. */
  regle: number
  /** Sous-total engagé — réglé compris —, en centimes. */
  engage: number
}

/** Le total réglé d'une ligne. */
function regleDe(ligne: LigneTresorerie): number {
  return ligne.settled ?? 0
}

/**
 * Le total engagé d'une ligne : ce qui est payé PLUS ce qui reste à payer.
 *
 * L'engagé contient le réglé, il ne s'y ajoute pas comme une seconde dépense. C'est la convention
 * de la page, et en diverger ferait un PDF dont les totaux ne retomberaient pas sur ceux de
 * l'écran — le genre d'écart qu'on ne s'explique pas six mois plus tard.
 */
function engageDe(ligne: LigneTresorerie): number {
  return (ligne.settled ?? 0) + (ligne.pending ?? 0)
}

/**
 * Les lignes d'une nature, regroupées par code d'imputation.
 *
 * Les codes sont rangés dans l'ordre alphanumérique, celui du plan comptable ; les lignes sans
 * code ferment la marche. Les écarter de l'export aurait été pire : le total du PDF ne
 * correspondrait plus à celui de l'écran, sans que rien ne le signale.
 *
 * Un code dont le libellé varie d'une ligne à l'autre — ce que la base interdit, mais qu'une
 * réponse d'API plus ancienne pourrait porter — garde le premier libellé rencontré, pour ne pas
 * scinder le groupe en deux et fausser les sous-totaux.
 */
export function regrouperParCode<L extends LigneTresorerie>(
  lignes: L[],
  nature: 'EXPENSE' | 'INCOME'
): GroupeDeCode<L>[] {
  const groupes = new Map<string, GroupeDeCode<L>>()

  for (const ligne of lignes) {
    if (ligne?.kind !== nature) continue

    const code = ligne.code?.code?.trim() || SANS_CODE
    const groupe = groupes.get(code) ?? {
      code,
      libelle: ligne.code?.label?.trim() || '',
      lignes: [],
      regle: 0,
      engage: 0,
    }

    groupe.lignes.push(ligne)
    groupe.regle += regleDe(ligne)
    groupe.engage += engageDe(ligne)
    groupes.set(code, groupe)
  }

  return [...groupes.values()].sort((a, b) => {
    // « Sans code » en dernier, quel que soit le tri : c'est un fourre-tout, pas un compte.
    if (a.code === SANS_CODE) return 1
    if (b.code === SANS_CODE) return -1
    return a.code.localeCompare(b.code, 'fr', { numeric: true })
  })
}

/** Ce que totalise une nature entière. */
export interface TotalDeNature {
  regle: number
  engage: number
}

/**
 * Le total d'une nature, calculé sur les GROUPES et non sur les lignes.
 *
 * Délibéré : un total recalculé depuis les lignes pourrait ne plus correspondre à la somme des
 * sous-totaux imprimés juste au-dessus, si le regroupement venait à en écarter une. Ici, le total
 * du bas est par construction la somme de ce que le lecteur a sous les yeux.
 */
export function totalDesGroupes<L extends LigneTresorerie>(
  groupes: GroupeDeCode<L>[]
): TotalDeNature {
  return groupes.reduce(
    (total, groupe) => ({
      regle: total.regle + groupe.regle,
      engage: total.engage + groupe.engage,
    }),
    { regle: 0, engage: 0 }
  )
}

/**
 * Le solde : ce qui rentre moins ce qui sort.
 *
 * Sur l'engagé comme sur le réglé, parce que les deux se lisent différemment — l'un dit où l'on en
 * est, l'autre où l'on va.
 */
export function soldeDe(charges: TotalDeNature, produits: TotalDeNature): TotalDeNature {
  return {
    regle: produits.regle - charges.regle,
    engage: produits.engage - charges.engage,
  }
}

/**
 * Le nom du fichier téléchargé.
 *
 * Daté, et c'est le point : un export de trésorerie se refait à mesure que les comptes se
 * complètent, et trois fichiers homonymes dans un dossier de téléchargements ne se distinguent
 * plus. Les accents et les espaces tombent, pour un nom que tous les systèmes acceptent.
 *
 * ⚠️ Composé morceau par morceau plutôt qu'écrit d'une pièce : une chaîne pointée littérale se
 * fait prendre pour une clé de traduction par l'analyse i18n, qui la signale alors comme
 * manquante. Le module stock a déjà buté là-dessus.
 */
export function nomFichierTresorerie(nomEdition: string | null | undefined, date: Date): string {
  const jour = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  const edition = (nomEdition ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  const morceaux = ['tresorerie', edition, jour].filter(Boolean)
  return `${morceaux.join('-')}.pdf`
}

/**
 * Un montant formaté, rendu imprimable par jsPDF.
 *
 * ⚠️ `Intl.NumberFormat('fr-FR')` sépare les milliers par une ESPACE INSÉCABLE ÉTROITE (U+202F) et
 * précède le symbole d'une espace insécable (U+00A0). Les polices standard de jsPDF sont encodées
 * en WinAnsi, qui ignore la première : « 4 124,16 € » s'imprimait « 4/124,16 € », et l'on ne s'en
 * aperçoit que sur les montants à quatre chiffres — jamais sur un jeu d'essai modeste.
 *
 * Les deux sont donc ramenées à une espace ordinaire. Le document y perd des insécables dont un
 * PDF n'a que faire : la ligne y est déjà figée, rien ne peut se couper.
 */
export function montantPourPdf(montant: string): string {
  return montant.replace(/[\u202f\u00a0]/g, ' ')
}

/** Une ligne du tableau imprimé, chaque cellule déjà réduite en texte. */
export type LigneImprimee = [string, string, string, string, string]

/** Le tableau d'une nature, et les lignes qui s'y détachent. */
export interface TableauImprime {
  lignes: LigneImprimee[]
  /**
   * Les rangs des lignes de sous-total, pour que la mise en page les teinte.
   *
   * Rendus par cette fonction plutôt que devinés d'après le libellé : reconnaître un sous-total à
   * son texte casserait dès qu'on traduit la page, et silencieusement — les lignes perdraient leur
   * fond sans que rien ne signale pourquoi.
   */
  sousTotaux: number[]
}

/**
 * Le tableau d'une nature, prêt pour la mise en page.
 *
 * Le code et son libellé occupent DEUX colonnes distinctes, et non un « 6257 — Réceptions » fondu
 * en une : c'est ce qui permet de trier, filtrer et recopier le document comme un document
 * comptable plutôt que comme une capture d'écran.
 *
 * Ils ne sont écrits que sur la PREMIÈRE ligne de chaque groupe : les répéter sur chaque écriture
 * remplirait la page d'un même code recopié dix fois, où l'œil ne trouve plus les ruptures.
 *
 * `formater` et `titrer` sont injectés plutôt qu'appelés ici : le formatage d'une devise dépend de
 * la locale et de l'édition, et le titre d'une ligne calculée est une clé de traduction — deux
 * choses que ce fichier n'a pas à connaître pour rester testable hors Nuxt.
 *
 * ⚠️ `titrer` n'est pas facultatif, et c'est délibéré. Les lignes venues des artistes et de la
 * billetterie portent une CLÉ (`ARTIST_PAYMENT`, `TICKETING_DONATIONS`) et non un libellé : écrire
 * `ligne.title` tel quel imprimait ces clés brutes dans un document destiné à un comptable.
 */
export function preparerTableau<L extends LigneTresorerie>(
  groupes: GroupeDeCode<L>[],
  formater: (centimes: number) => string,
  titrer: (ligne: L) => string,
  libelleSansCode: string,
  libelleSousTotal: string
): TableauImprime {
  const lignes: LigneImprimee[] = []
  const sousTotaux: number[] = []

  for (const groupe of groupes) {
    groupe.lignes.forEach((ligne, rang) => {
      const premiere = rang === 0
      lignes.push([
        premiere ? (groupe.code === SANS_CODE ? libelleSansCode : groupe.code) : '',
        premiere && groupe.code !== SANS_CODE ? groupe.libelle : '',
        titrer(ligne),
        formater(regleDe(ligne)),
        formater(engageDe(ligne)),
      ])
    })

    // Le sous-total n'a de sens que s'il résume plusieurs écritures : sous un code qui n'en porte
    // qu'une, il répéterait la ligne juste au-dessus.
    if (groupe.lignes.length > 1) {
      sousTotaux.push(lignes.length)
      lignes.push(['', '', libelleSousTotal, formater(groupe.regle), formater(groupe.engage)])
    }
  }

  return { lignes, sousTotaux }
}
