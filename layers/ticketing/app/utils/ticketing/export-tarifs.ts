import { isFixedPrice, type TicketingTier } from './tiers'

/**
 * Les lignes d'un export de tarifs — CSV comme PDF.
 *
 * Écrit à part du composant, et en fonctions pures, pour deux raisons : c'est ici que la valeur
 * peut être fausse, et un export qui ne dit pas la même chose que l'écran est pire qu'une absence
 * d'export. Les deux formats partagent donc ces lignes, plutôt que de les reconstruire chacun.
 *
 * Les formateurs sont INJECTÉS — montant, date — au lieu d'être importés : ils dépendent de la
 * devise de l'édition et de son fuseau, que ce module n'a pas à connaître, et c'est ce qui permet
 * de le vérifier sur des chaînes.
 */

/**
 * Ce qu'un tarif peut rendre, colonne par colonne.
 *
 * Les identifiants sont EXACTEMENT ceux des colonnes du tableau, et ce n'est pas un détail : c'est
 * lui qui fait que décocher une colonne à l'écran la retire du fichier. Deux jeux de noms, même
 * bien traduits l'un dans l'autre, auraient laissé la visibilité sans effet sur l'export.
 */
export const COLONNES_EXPORT_TARIFS = [
  'position',
  'title',
  'description',
  'price',
  'validFrom',
  'validUntil',
  'tickets',
  'quotas',
  'handoutItems',
  'meals',
  'isActive',
] as const

export type ColonneExportTarif = (typeof COLONNES_EXPORT_TARIFS)[number]

export interface FormateursDExport {
  /** Un montant en centimes, rendu dans la devise de l'édition. */
  montant: (centimes: number) => string
  /** Un instant, rendu dans le fuseau de l'édition. */
  date: (valeur: string | Date) => string
  /** Un repas, rendu comme la liste le fait. */
  repas: (repas: unknown) => string
  /** « Oui » / « Non », que l'appelant traduit. */
  oui: string
  non: string
}

/**
 * Le prix affiché, tel que la colonne le montre.
 *
 * Un tarif libre n'a pas de prix : il a des bornes, et n'en affiche parfois qu'une. Rendre « 0 »
 * dans ce cas ferait croire à la gratuité — c'est le genre de chiffre faux mais plausible qui ne
 * se remarque qu'une fois la caisse faite.
 */
export function prixDUnTarif(tarif: TicketingTier, f: FormateursDExport): string {
  if (isFixedPrice(tarif)) return f.montant(tarif.price)

  const bornes: string[] = []
  if (tarif.minAmount != null) bornes.push(`Min: ${f.montant(tarif.minAmount)}`)
  if (tarif.maxAmount != null) bornes.push(`Max: ${f.montant(tarif.maxAmount)}`)
  return bornes.length ? bornes.join(' – ') : 'Libre'
}

/** Les valeurs d'une colonne, pour un tarif. Toujours une chaîne : un export n'a pas de types. */
export function valeurDeColonne(
  tarif: TicketingTier,
  colonne: ColonneExportTarif,
  f: FormateursDExport
): string {
  switch (colonne) {
    case 'position':
      return String(tarif.position ?? '')
    // Le nom personnalisé prime sur celui que la billetterie externe a fourni : c'est celui que
    // l'organisateur a choisi, et celui que l'écran montre.
    case 'title':
      return tarif.customName || tarif.name || ''
    case 'description':
      return tarif.description || ''
    case 'price':
      return prixDUnTarif(tarif, f)
    case 'validFrom':
      return tarif.validFrom ? f.date(tarif.validFrom) : ''
    case 'validUntil':
      return tarif.validUntil ? f.date(tarif.validUntil) : ''
    case 'tickets':
      return String((tarif as { soldCount?: number }).soldCount ?? 0)
    case 'quotas':
      return (tarif.quotas ?? [])
        .map((q: any) => q.quota?.title)
        .filter(Boolean)
        .join(', ')
    case 'handoutItems':
      return (tarif.handoutItems ?? [])
        .map((a: any) => {
          const nom = a.handoutItem?.name
          if (!nom) return null
          return a.quantity > 1 ? `${nom} ×${a.quantity}` : nom
        })
        .filter(Boolean)
        .join(', ')
    case 'meals':
      return (tarif.meals ?? [])
        .map((r: any) => (r.meal ? f.repas(r.meal) : null))
        .filter(Boolean)
        .join(', ')
    case 'isActive':
      return tarif.isActive ? f.oui : f.non
  }
}

/**
 * Les colonnes du tableau qui ont un sens dans un fichier.
 *
 * Deux n'en ont pas : la poignée de réordonnancement, qui ne se glisse pas sur du papier, et le
 * menu d'actions. Elles sont retirées ici plutôt que masquées à l'écran, où elles servent.
 */
const COLONNES_NON_EXPORTABLES = ['actions'] as const

/**
 * Les colonnes retenues pour un export, telles que LE TABLEAU les donne.
 *
 * L'ordre et la visibilité viennent de lui, et non d'une liste tenue en parallèle qui finirait par
 * diverger : décocher une colonne doit la retirer des DEUX formats, sans que l'écran ait à le
 * répéter. Une colonne inconnue du module est ignorée — mieux vaut une colonne en moins qu'une
 * colonne vide dont personne ne sait ce qu'elle devait porter.
 */
export function colonnesAExporter(idsVisibles: readonly string[]): ColonneExportTarif[] {
  return idsVisibles.filter(
    (id): id is ColonneExportTarif =>
      !(COLONNES_NON_EXPORTABLES as readonly string[]).includes(id) &&
      (COLONNES_EXPORT_TARIFS as readonly string[]).includes(id)
  )
}

/**
 * Le tableau complet, dans l'ordre d'affichage des tarifs et des colonnes demandées.
 *
 * `apprete` laisse passer la valeur telle quelle par défaut. Le PDF y branche `texteImprimable` :
 * les polices de jsPDF impriment l'espace insécable étroite des montants en barre oblique, et une
 * description sur trois lignes ferait exploser la hauteur d'une ligne. Le fichier tableur, lui,
 * lit très bien les deux — d'où le passage en paramètre plutôt qu'en dur.
 */
export function lignesDExportDesTarifs(
  tarifs: readonly TicketingTier[],
  f: FormateursDExport,
  colonnes: readonly ColonneExportTarif[] = COLONNES_EXPORT_TARIFS,
  apprete: (valeur: string, colonne: ColonneExportTarif) => string = (valeur) => valeur
): string[][] {
  return tarifs.map((tarif) =>
    colonnes.map((colonne) => apprete(valeurDeColonne(tarif, colonne, f), colonne))
  )
}
