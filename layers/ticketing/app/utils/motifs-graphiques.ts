import type { LegendItem, Chart as ChartJS } from 'chart.js'

/**
 * Distinguer l'édition comparée de l'édition en cours, sans changer de couleur.
 *
 * Une première version traçait la référence en courbe noire pointillée par-dessus les barres.
 * L'intention était bonne — un repère, pas une catégorie de plus — mais à l'usage elle se perdait
 * dans le graphique, et rien ne disait à quelle série chacune de ses valeurs correspondait.
 *
 * La règle retenue est plus simple à lire et se passe de légende : **même couleur, hachurée**.
 * Le bleu reste le bleu, le vert reste le vert ; seule la texture change, et elle ne dit qu'une
 * chose — « ceci est l'autre édition ». Les deux piles se posent alors côte à côte, catégorie par
 * catégorie, et la comparaison se fait sans quitter la colonne des yeux.
 *
 * ⚠️ Ce fichier touche au `canvas` : il n'existe pas au rendu serveur. Chaque fonction retombe
 * donc sur la couleur pleine plutôt que d'échouer — un graphique sans hachures reste un graphique.
 */

/** La pile de l'édition qu'on regarde. Deux piles nommées = deux colonnes côte à côte. */
export const PILE_COURANTE = 'courante'
/** La pile de l'édition à laquelle on se compare. */
export const PILE_COMPAREE = 'comparee'

/** Le côté du motif, en pixels. Assez petit pour hachurer une barre étroite sans la boucher. */
const COTE = 8

/** Le gris des témoins de la pastille : neutre, il ne se confond avec aucune catégorie. */
const GRIS = 'rgb(156 163 175)' // gray-400

/**
 * Les deux témoins qui expliquent la hachure, au-dessus du graphique.
 *
 * En style en ligne et non en classes utilitaires, parce qu'une première version s'appuyait sur
 * `bg-gray-400` et ne dessinait RIEN : le témoin plein restait invisible, et la pastille ne
 * montrait donc que la moitié de ce qu'elle devait expliquer. Une couleur qu'on impose ici ne
 * dépend plus de la palette du thème.
 */
export const APLAT_CSS = { backgroundColor: GRIS }
export const MOTIF_CSS = {
  backgroundImage: `repeating-linear-gradient(45deg, ${GRIS} 0 2px, rgb(156 163 175 / 0.3) 2px 6px)`,
}

/**
 * Les motifs déjà fabriqués, par couleur.
 *
 * Un `computed` de graphique se recalcule à chaque filtre coché : sans ce cache, on créait un
 * canvas par série et par recalcul, que rien ne libérait avant le passage du ramasse-miettes.
 */
const cache = new Map<string, CanvasPattern | string>()

/**
 * La même couleur, hachurée en diagonale.
 *
 * Le fond reprend la couleur en transparence pour que la barre garde sa teinte de loin, et les
 * rayures la reprennent en plein pour que la texture se voie de près. Rendre les rayures seules
 * sur fond transparent donnerait des barres évidées, illisibles sur un graphique empilé.
 */
export function motifRaye(couleur: string): CanvasPattern | string {
  const deja = cache.get(couleur)
  if (deja !== undefined) return deja

  // Pas de DOM au rendu serveur, et pas de contexte 2D dans certains environnements de test.
  if (typeof document === 'undefined') return couleur
  const canvas = document.createElement('canvas')
  canvas.width = COTE
  canvas.height = COTE
  const ctx = canvas.getContext('2d')
  if (ctx === null) return couleur

  ctx.fillStyle = couleur
  ctx.globalAlpha = 0.3
  ctx.fillRect(0, 0, COTE, COTE)

  ctx.globalAlpha = 1
  ctx.strokeStyle = couleur
  ctx.lineWidth = 2
  ctx.beginPath()
  // Trois traits pour que la tuile se raccorde à ses voisines : la diagonale principale, plus
  // les deux coins qu'elle laisse découverts. Sans eux, la hachure se brise tous les 8 pixels.
  ctx.moveTo(0, COTE)
  ctx.lineTo(COTE, 0)
  ctx.moveTo(-1, 1)
  ctx.lineTo(1, -1)
  ctx.moveTo(COTE - 1, COTE + 1)
  ctx.lineTo(COTE + 1, COTE - 1)
  ctx.stroke()

  const motif = ctx.createPattern(canvas, 'repeat') ?? couleur
  cache.set(couleur, motif)
  return motif
}

/** Une série du graphique, réduite à ce dont la comparaison a besoin. */
export interface SerieDeGraphique {
  /** Le nom de la série dans les données — c'est lui qui apparie les deux éditions. */
  cle: string
  /** Le libellé lisible, celui de la légende. */
  label: string
  /** La couleur de remplissage. */
  fond: string
  /** La couleur du contour. */
  bordure: string
  /** Les valeurs de l'édition en cours. */
  valeurs: readonly (number | null)[]
}

/** Le jeu de données de l'édition en cours, pour une série. */
export function jeuCourant(serie: SerieDeGraphique) {
  return {
    label: serie.label,
    data: serie.valeurs,
    backgroundColor: serie.fond,
    borderColor: serie.bordure,
    borderWidth: 1,
    stack: PILE_COURANTE,
    // Repris par la légende pour basculer les deux éditions d'une série ensemble.
    cle: serie.cle,
  }
}

/**
 * Le jeu de données jumeau, celui de l'édition comparée.
 *
 * Il porte le nom de l'édition dans son libellé — c'est ce que l'infobulle montre au survol, et
 * c'est là qu'on lève l'ambiguïté sans encombrer la légende de six entrées supplémentaires.
 */
export function jeuCompare(
  serie: SerieDeGraphique,
  comparaison: { libelle: string; series: Record<string, (number | null)[]> }
) {
  return {
    label: `${serie.label} — ${comparaison.libelle}`,
    data: comparaison.series[serie.cle] ?? [],
    backgroundColor: motifRaye(serie.fond),
    borderColor: serie.bordure,
    borderWidth: 1,
    stack: PILE_COMPAREE,
    cle: serie.cle,
    comparaison: true,
  }
}

/**
 * La légende n'affiche QUE l'édition en cours.
 *
 * Doubler les entrées n'apprendrait rien : les jumelles portent les mêmes couleurs et les mêmes
 * catégories. Ce qui distingue les deux éditions — la hachure — est expliqué une fois, en clair,
 * au-dessus du graphique.
 */
export function sansLesJumelles(item: LegendItem, data: { datasets: unknown[] }): boolean {
  const jeu = data.datasets[item.datasetIndex ?? -1] as { comparaison?: boolean } | undefined
  return jeu?.comparaison !== true
}

/**
 * Cliquer une catégorie masque les DEUX éditions.
 *
 * La légende ne montrant que l'édition en cours, le comportement par défaut n'aurait masqué
 * qu'une des deux piles : décocher « Bénévoles » aurait laissé les bénévoles de l'an dernier
 * seuls à l'écran, ce qui se lirait comme une comparaison alors que ce n'en est plus une.
 */
export function basculerLesDeuxEditions(
  _evenement: unknown,
  item: LegendItem,
  legende: { chart: ChartJS }
): void {
  const chart = legende.chart
  const cle = (chart.data.datasets[item.datasetIndex ?? -1] as { cle?: string } | undefined)?.cle
  chart.data.datasets.forEach((jeu, index) => {
    if ((jeu as { cle?: string }).cle !== cle) return
    chart.setDatasetVisibility(index, !chart.isDatasetVisible(index))
  })
  chart.update()
}
