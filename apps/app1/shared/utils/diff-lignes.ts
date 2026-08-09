/**
 * Comparaison ligne à ligne de deux textes.
 *
 * L'écran de mise à jour par IA montrait l'ancienne et la nouvelle valeur côte à côte, à charge
 * pour le lecteur de repérer ce qui change. Sur un programme de journée de mille caractères dont
 * trois lignes bougent, c'est un travail de relecture que la machine sait faire.
 *
 * L'algorithme est celui de la plus longue sous-séquence commune : les lignes conservées gardent
 * leur place, les autres sont marquées supprimées à gauche et ajoutées à droite.
 */

export interface LigneComparee {
  texte: string
  /** Vrai pour une ligne qui n'existe que d'un côté. */
  modifiee: boolean
}

export interface ComparaisonLignes {
  anciennes: LigneComparee[]
  nouvelles: LigneComparee[]
  /** Vrai dès qu'une ligne diffère : de quoi éviter d'habiller un texte identique. */
  aDesDifferences: boolean
}

/**
 * Table de la plus longue sous-séquence commune.
 *
 * Bornée : au-delà, le coût quadratique deviendrait sensible pour un gain nul — personne ne relit
 * un diff de mille lignes dans une carte de comparaison.
 */
const MAX_LIGNES = 400

function tableLcs(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }
  return table
}

export function comparerLignes(ancien: string, nouveau: string): ComparaisonLignes {
  const a = (ancien || '').split('\n')
  const b = (nouveau || '').split('\n')

  // Au-delà de la borne, on renonce au détail plutôt que de faire ramer l'écran : tout est
  // présenté comme modifié, ce qui reste honnête.
  if (a.length > MAX_LIGNES || b.length > MAX_LIGNES) {
    return {
      anciennes: a.map((texte) => ({ texte, modifiee: true })),
      nouvelles: b.map((texte) => ({ texte, modifiee: true })),
      aDesDifferences: ancien !== nouveau,
    }
  }

  const table = tableLcs(a, b)
  const anciennes: LigneComparee[] = []
  const nouvelles: LigneComparee[] = []

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      anciennes.push({ texte: a[i]!, modifiee: false })
      nouvelles.push({ texte: b[j]!, modifiee: false })
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      anciennes.push({ texte: a[i]!, modifiee: true })
      i++
    } else {
      nouvelles.push({ texte: b[j]!, modifiee: true })
      j++
    }
  }
  while (i < a.length) anciennes.push({ texte: a[i++]!, modifiee: true })
  while (j < b.length) nouvelles.push({ texte: b[j++]!, modifiee: true })

  return {
    anciennes,
    nouvelles,
    aDesDifferences: anciennes.some((l) => l.modifiee) || nouvelles.some((l) => l.modifiee),
  }
}

/**
 * Vrai quand un affichage ligne à ligne apporte quelque chose.
 *
 * Sur une date ou une URL — une seule ligne de part et d'autre — colorer la ligne entière
 * n'apprendrait rien de plus que les deux encadrés déjà présents.
 */
export function meriteUnDiff(ancien: string, nouveau: string): boolean {
  return (ancien || '').includes('\n') || (nouveau || '').includes('\n')
}
