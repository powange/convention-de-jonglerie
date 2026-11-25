/**
 * Ce qu'un export emporte : les colonnes que le tableau MONTRE, et elles seules.
 *
 * ⚠️ LE DÉFAUT CORRIGÉ. Chaque écran à colonnes masquables porte un menu de sélection et, juste à
 * côté, ses boutons d'export. Le commentaire de `UiColumnsMenu` annonçait déjà l'intention —
 * « Choisir ses colonnes, puis les emporter » — mais les exports construisaient leurs en-têtes et
 * leurs lignes sans jamais consulter la sélection. On masquait trois colonnes à l'écran, et le CSV
 * les ramenait toutes.
 *
 * ⚠️⚠️ `visibilite` NE LISTE QUE LES COLONNES MASQUÉES. C'est la forme que produit
 * `colonnesMasqueesDepuisUrl` : une colonne absente de l'objet est VISIBLE. Tester `=== true`
 * n'exporterait donc plus rien tant que l'utilisateur n'aurait rien touché — exactement l'inverse
 * du défaut qu'on corrige.
 *
 * 📍 POURQUOI DES DESCRIPTEURS plutôt qu'un filtrage de tableaux parallèles : un export se compose
 * d'en-têtes et de valeurs, et les deux doivent être retirés ENSEMBLE. Les garder dans deux listes
 * qu'on filtre séparément est précisément la façon dont une colonne finit décalée d'un cran — le
 * genre de défaut qui ne se voit qu'une fois le fichier ouvert.
 */

/** Une colonne telle que l'export la décrit : son identifiant de tableau, son titre, sa valeur. */
export interface ColonneExportable<L> {
  /**
   * L'identifiant de la colonne DANS LE TABLEAU.
   *
   * C'est lui qui fait le lien avec la sélection : il doit correspondre à l'`accessorKey` (ou à
   * l'`id`) de la colonne. Un identifiant qui ne correspond à rien rend la colonne toujours
   * exportée — jamais invisible —, ce qui est le défaut le moins grave des deux.
   */
  id: string
  entete: string
  valeur: (ligne: L) => string
}

/** Une colonne est exportée tant qu'elle n'a pas été explicitement masquée. */
export function colonneVisible(
  id: string,
  visibilite: Record<string, boolean> | null | undefined
): boolean {
  return visibilite?.[id] !== false
}

/**
 * Les colonnes à emporter, dans l'ordre où l'export les a déclarées.
 *
 * ⚠️ LE NOM ÉVITE UNE COLLISION D'AUTO-IMPORT : trois écrans ont déjà une fonction locale
 * `colonnesAExporter`, et Nuxt auto-importe les utils. Un homonyme en éclipserait un autre sans
 * que rien ne le signale — le dépôt a déjà payé ce défaut une fois.
 */
export function colonnesExportablesVisibles<L>(
  colonnes: readonly ColonneExportable<L>[],
  visibilite: Record<string, boolean> | null | undefined
): ColonneExportable<L>[] {
  return colonnes.filter((colonne) => colonneVisible(colonne.id, visibilite))
}

/**
 * L'export complet : les en-têtes retenus, et les lignes alignées dessus.
 *
 * Rendus ensemble pour que rien ne puisse les désaligner — c'est la raison d'être de cette
 * fonction plutôt que de deux appels séparés.
 */
export function tableauAExporter<L>(
  colonnes: readonly ColonneExportable<L>[],
  visibilite: Record<string, boolean> | null | undefined,
  lignes: readonly L[]
): { entetes: string[]; lignes: string[][] } {
  const retenues = colonnesExportablesVisibles(colonnes, visibilite)
  return {
    entetes: retenues.map((colonne) => colonne.entete),
    lignes: lignes.map((ligne) => retenues.map((colonne) => colonne.valeur(ligne))),
  }
}
