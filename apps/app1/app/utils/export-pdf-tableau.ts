import {
  dessinerCaseACocher,
  entetesAvecCoche,
  lignesAvecCoche,
  styleColonneCoche,
} from './pdf-case-a-cocher'

/**
 * Un tableau de gestion, mis en page pour l'impression.
 *
 * Le pendant de `shared/utils/csv` : là où `versCsv` écrit un fichier pour un tableur, celui-ci
 * écrit une feuille pour le terrain. Les deux prennent la même matière — des en-têtes et des
 * lignes — parce qu'un export ne devrait pas obliger à préparer ses données deux fois.
 *
 * Il existe parce que sept écrans avaient recopié la même tuyauterie `jsPDF` dans leur propre
 * fichier : mille quarante-cinq lignes au total, pour des titres, une date et un tableau. Cette
 * mise en page-ci est faite pour les tableaux qui n'avaient pas encore de PDF du tout ; les
 * autres gardent la leur, qui porte des choix propres à chaque écran.
 *
 * ⚠️ `jsPDF` n'est chargé qu'à l'appel. La bibliothèque et son greffon pèsent lourd, et la
 * plupart des visites d'un écran de gestion n'exportent rien.
 */

/** Ce qu'il faut savoir pour composer la feuille. */
export interface FeuilleDeTableau {
  /** En gros, en haut : ce que le lecteur doit reconnaître d'un coup d'œil. */
  titre: string
  /** La convention et l'édition, en dessous. Absent, la ligne saute. */
  sousTitre?: string | null
  entetes: readonly string[]
  lignes: readonly unknown[][]
  /**
   * La ligne de contexte, sous le sous-titre : la date, le nombre de lignes, un filtre posé.
   *
   * Une feuille détachée de l'écran n'a plus rien pour se situer — ni pastille de filtre, ni
   * compteur. Deux listes d'années différentes se ressemblent trop pour qu'on les distingue.
   */
  mention?: string | null
  /** Paysage dès qu'il y a plus de six colonnes : au-delà, les noms se coupent en trois. */
  orientation?: 'portrait' | 'landscape'
  /** Sans extension : elle est ajoutée ici. */
  nomFichier: string
  /** La couleur de la ligne de titres, pour que la feuille se rattache à son module. */
  couleurEntete?: [number, number, number]
}

/** Marge gauche et droite, en millimètres. */
const MARGE = 14

/** Au-delà, le portrait ne tient plus. Mesuré sur les tableaux existants. */
const COLONNES_AVANT_PAYSAGE = 6

/** L'orientation, déduite du nombre de colonnes quand l'appelant n'en impose pas. */
export function orientationPour(
  nombreDeColonnes: number,
  choisie?: 'portrait' | 'landscape'
): 'portrait' | 'landscape' {
  if (choisie) return choisie
  return nombreDeColonnes > COLONNES_AVANT_PAYSAGE ? 'landscape' : 'portrait'
}

/** Le nom du fichier, extension comprise, sans jamais la doubler. */
export function nomAvecExtensionPdf(nom: string): string {
  const propre = nom.trim() || 'export'
  return propre.toLowerCase().endsWith('.pdf') ? propre : `${propre}.pdf`
}

/**
 * Compose la feuille et la propose au téléchargement.
 *
 * La colonne de cases à cocher est ajoutée d'office — c'est une feuille qu'on parcourt en cochant
 * — sauf si le tableau en porte déjà une.
 */
export async function exporterTableauEnPdf(feuille: FeuilleDeTableau): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { applyPlugin } = await import('jspdf-autotable')
  applyPlugin(jsPDF)

  const doc = new jsPDF({
    orientation: orientationPour(feuille.entetes.length, feuille.orientation),
  })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(feuille.titre, MARGE, 16)

  let hauteur = 22
  doc.setFont('helvetica', 'normal')

  if (feuille.sousTitre) {
    doc.setFontSize(10)
    doc.text(feuille.sousTitre, MARGE, hauteur)
    hauteur += 6
  }

  if (feuille.mention) {
    doc.setFontSize(9)
    doc.text(feuille.mention, MARGE, hauteur)
    hauteur += 6
  }

  // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
  doc.autoTable({
    startY: hauteur + 2,
    margin: { left: MARGE, right: MARGE },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    ...(feuille.couleurEntete ? { headStyles: { fillColor: feuille.couleurEntete } } : {}),
    columnStyles: styleColonneCoche(),
    head: [entetesAvecCoche(feuille.entetes)],
    body: lignesAvecCoche(feuille.entetes, feuille.lignes as unknown[][]).map((ligne) =>
      ligne.map((cellule) => (cellule == null ? '' : String(cellule)))
    ),
    didDrawCell: (cellule: unknown) => dessinerCaseACocher(doc, cellule as never),
  })

  doc.save(nomAvecExtensionPdf(feuille.nomFichier))
}
