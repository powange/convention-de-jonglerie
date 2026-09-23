/**
 * Mettre un texte en état d'être imprimé par jsPDF.
 *
 * Vivait dans le layer des artistes, d'où la billetterie n'a pas à dépendre. La règle vaut pour
 * tout export PDF du dépôt — elle porte sur la police, pas sur les données —, et une seconde
 * copie aurait fini par dire autre chose que la première.
 */

/**
 * Rend un texte imprimable par jsPDF.
 *
 * ⚠️ Les polices standard de jsPDF sont encodées en WinAnsi, qui ignore l'espace insécable étroite
 * (U+202F) que `Intl.NumberFormat('fr-FR')` emploie entre les milliers : « 1 250,00 € »
 * s'imprimait « 1/250,00 € ». Le défaut ne se voit que sur les montants à quatre chiffres, jamais
 * sur un jeu d'essai modeste — la trésorerie l'a déjà payé.
 *
 * Les retours à la ligne sont ramenés à des espaces : une note d'organisateur sur trois lignes
 * ferait exploser la hauteur d'une ligne de tableau.
 */
export function texteImprimable(
  valeur: string | null | undefined,
  { multiligne = false }: { multiligne?: boolean } = {}
): string {
  if (valeur === null || valeur === undefined) return ''

  const sansInsecables = String(valeur).replace(/[\u202f\u00a0]/g, ' ')

  if (!multiligne) return sansInsecables.replace(/\s*\n+\s*/g, ' ').trim()

  // Multiligne : on garde UN retour entre les lignes utiles, et on jette les vides. `autoTable`
  // sait les rendre, à condition qu'on lui passe `overflow: 'linebreak'`.
  return sansInsecables
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .join('\n')
}
