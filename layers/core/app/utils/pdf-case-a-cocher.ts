/**
 * La colonne de cases à cocher d'un tableau exporté en PDF.
 *
 * Un tableau imprimé sert à être parcouru sur le terrain — on appelle les bénévoles, on relève le
 * matériel, on sert les repas — et l'on coche au fur et à mesure. Sans case, on coche quand même :
 * dans la marge, sur le nom, d'un trait qui rature ce qu'on voulait lire.
 *
 * ⚠️ La case est DESSINÉE, jamais écrite. Le caractère « ☐ » (U+2610) paraît évident et serait un
 * piège : les polices standard de jsPDF sont encodées en WinAnsi, qui ne le connaît pas — il
 * ressortirait en symbole arbitraire. Le module a déjà payé ce genre de dette avec l'espace
 * insécable étroite des montants en euros, qui s'imprimait en barre oblique.
 *
 * Le motif vient du PDF de restauration, qui l'avait pour lui seul. Il est ici pour que les autres
 * tableaux n'aient pas à le redécouvrir — ni à le redécouvrir de travers.
 */

/** La largeur de la colonne, en millimètres. Assez pour la case, pas plus. */
export const LARGEUR_COLONNE_COCHE = 6

/** Le côté du carré, en millimètres. */
export const COTE_CASE = 4

/**
 * L'en-tête de la colonne : vide.
 *
 * Rien à y écrire — « Fait ? » prendrait trois fois la largeur de la case pour dire ce que la case
 * dit déjà. La colonne se comprend à ce qu'elle contient.
 */
export const ENTETE_COCHE = ''

/**
 * Le style de colonne à passer à `autoTable`, sous l'index 0.
 *
 * @example
 * columnStyles: { ...styleColonneCoche(), 1: { cellWidth: 20 } }
 */
export function styleColonneCoche(): Record<number, { cellWidth: number }> {
  return { 0: { cellWidth: LARGEUR_COLONNE_COCHE } }
}

/** Ce que `didDrawCell` reçoit d'`autoTable`, réduit à ce qu'on lit ici. */
export interface CelluleDessinee {
  column?: { index?: number }
  section?: string
  cell?: { x?: number; y?: number; width?: number; height?: number }
}

/** Ce qu'on demande au document : tracer un rectangle. */
export interface TraceurDeRectangle {
  rect: (x: number, y: number, largeur: number, hauteur: number, style: string) => void
}

/**
 * Dessine la case, centrée dans la cellule, pour les seules lignes de DONNÉES.
 *
 * L'en-tête et le pied en sont exclus : une case à cocher dans la ligne de titre inviterait à
 * cocher la colonne entière, et une dans le pied n'aurait rien à désigner.
 *
 * Rendue tolérante aux champs absents parce qu'elle est appelée par une bibliothèque tierce, à
 * travers un rappel typé `any` chez tous ses appelants : une propriété manquante ferait tomber
 * l'export entier, pour une case.
 */
export function dessinerCaseACocher(doc: TraceurDeRectangle, cellule: CelluleDessinee): void {
  if (cellule.column?.index !== 0 || cellule.section !== 'body') return

  const { x, y, width, height } = cellule.cell ?? {}
  if (typeof x !== 'number' || typeof y !== 'number') return
  if (typeof width !== 'number' || typeof height !== 'number') return

  doc.rect(x + (width - COTE_CASE) / 2, y + (height - COTE_CASE) / 2, COTE_CASE, COTE_CASE, 'S')
}

/**
 * Un tableau a-t-il déjà sa colonne à cocher ?
 *
 * On reconnaît celle-ci à son en-tête VIDE : c'est sa forme, ici comme dans le PDF de
 * restauration qui l'avait en premier. Deux colonnes de cases donneraient deux endroits où cocher
 * la même ligne.
 *
 * Attention à ne pas confondre avec une colonne simplement laissée en blanc pour écrire : la
 * feuille d'inventaire du stock porte une colonne « Compté » vide, où l'on note un NOMBRE. Elle a
 * un titre, donc elle ne compte pas — et elle n'empêche pas de cocher « cette ligne est faite »,
 * qui est une autre information.
 */
export function aDejaUneColonneACocher(entetes: readonly string[]): boolean {
  return entetes.length > 0 && (entetes[0] ?? '').trim() === ''
}

/**
 * Les en-têtes, précédés de la colonne à cocher.
 *
 * Sans effet si le tableau en porte déjà une : on ne coche pas deux fois la même ligne.
 */
export function entetesAvecCoche(entetes: readonly string[]): string[] {
  if (aDejaUneColonneACocher(entetes)) return [...entetes]
  return [ENTETE_COCHE, ...entetes]
}

/**
 * Les lignes, décalées d'une cellule vide pour laisser la place à la case.
 *
 * ⚠️ Toujours appelée AVEC les en-têtes correspondants, jamais seule : décaler les unes sans les
 * autres produit un tableau dont chaque colonne porte le titre de sa voisine. Rien ne lève, et
 * tout est faux. D'où le fait que la décision — décaler ou non — se prenne sur les en-têtes, dans
 * les deux fonctions.
 */
export function lignesAvecCoche<T>(
  entetes: readonly string[],
  lignes: readonly T[][]
): (T | string)[][] {
  if (aDejaUneColonneACocher(entetes)) return lignes.map((ligne) => [...ligne])
  return lignes.map((ligne) => ['', ...ligne])
}
