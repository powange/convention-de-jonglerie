import { texteImprimable } from '~~/shared/utils/texte-imprimable'

/**
 * La feuille technique d'une édition, mise en tableaux.
 *
 * Elle s'écrivait jusqu'ici en paragraphes empilés, composés à la main ligne à ligne : un titre,
 * un bloc de texte, un autre titre. Sur un cabaret de quinze numéros, rien ne distinguait plus la
 * mise en place d'un numéro des besoins du suivant, et la régie lisait un mur.
 *
 * Un tableau PAR SPECTACLE, et non un seul pour toute l'édition : ce document se découpe et se
 * distribue — on emporte la page du cabaret de samedi, pas les quarante pages de l'édition. Les
 * colonnes restent les mêmes d'un tableau à l'autre pour qu'on les lise une fois.
 *
 * Fonctions pures : la composition se vérifie sur des chaînes, sans monter jsPDF.
 */

/** Ce qu'un spectacle porte, tel que le point d'API le rend. */
export interface SpectacleTechnique {
  title: string
  type: string
  /** Les instants de passage, en ISO. Le point d'API les rend, et les trie. */
  performances?: string[]
  technicalNeeds: string | null
  artists: string[]
  acts: NumeroTechnique[]
}

export interface NumeroTechnique {
  title: string
  technicalNeeds: string | null
  stageSetup: string | null
  artists: string[]
}

/** Les libellés, injectés : ce module ne connaît ni la langue ni le fuseau. */
export interface LibellesTechniques {
  /** « Aucun besoin renseigné ». */
  aucunBesoin: string
  /** L'en-tête de chaque colonne. */
  colonneNumero: string
  colonneArtistes: string
  colonneBesoins: string
  colonneMiseEnPlace: string
  /** Un instant de passage, rendu dans le fuseau de l'édition. */
  date: (instant: string) => string
}

/**
 * Les colonnes, identiques pour tous les spectacles.
 *
 * « Mise en place » ne vaut que pour les numéros d'un cabaret, et reste vide ailleurs — plutôt que
 * de changer de tableau selon le type. Une colonne toujours à la même place se lit sans y penser ;
 * deux structures de tableau dans un même document obligent à relire les en-têtes à chaque page.
 */
export function entetesTechniques(l: LibellesTechniques): string[] {
  return [l.colonneNumero, l.colonneArtistes, l.colonneBesoins, l.colonneMiseEnPlace]
}

/**
 * Le sous-titre d'un spectacle : ses passages.
 *
 * Le point d'API les rend et s'en sert pour trier — « l'ordre dans lequel la régie vit la
 * soirée », dit son commentaire — mais le document ne les montrait pas. Une feuille technique sans
 * horaire oblige à retourner à l'écran pour savoir quand on monte.
 */
export function passagesDUnSpectacle(spectacle: SpectacleTechnique, l: LibellesTechniques): string {
  return (spectacle.performances ?? []).map((instant) => l.date(instant)).join(' · ')
}

/**
 * Les lignes d'un spectacle.
 *
 * Un cabaret rend une ligne par numéro ; un spectacle sans numéro en rend UNE, la sienne. Rendre
 * zéro ligne pour ce dernier l'aurait fait disparaître du document alors qu'il a bien des besoins.
 */
export function lignesDUnSpectacle(
  spectacle: SpectacleTechnique,
  l: LibellesTechniques
): string[][] {
  const cellule = (valeur: string | null | undefined, multiligne = false) =>
    texteImprimable(valeur ?? '', { multiligne })

  if (spectacle.acts.length) {
    return spectacle.acts.map((numero) => [
      cellule(numero.title),
      cellule(numero.artists.join(', ')),
      cellule(numero.technicalNeeds?.trim() || l.aucunBesoin, true),
      cellule(numero.stageSetup?.trim() ?? '', true),
    ])
  }

  return [
    [
      cellule(spectacle.title),
      cellule(spectacle.artists.join(', ')),
      cellule(spectacle.technicalNeeds?.trim() || l.aucunBesoin, true),
      '',
    ],
  ]
}

/**
 * Les besoins portés par le CABARET lui-même, au-dessus de ses numéros.
 *
 * Un cabaret peut en avoir — un fond de scène, une régie commune — qui ne tiennent dans aucun
 * numéro. Ils étaient rendus avant, et le resteraient perdus si le tableau ne parlait que des
 * numéros. Vide quand il n'y en a pas : on n'écrit pas « aucun besoin » pour un cabaret dont
 * chaque numéro, lui, en déclare.
 */
export function besoinsPropresDuSpectacle(spectacle: SpectacleTechnique): string {
  if (!spectacle.acts.length) return ''
  return texteImprimable(spectacle.technicalNeeds?.trim() ?? '', { multiligne: true })
}
