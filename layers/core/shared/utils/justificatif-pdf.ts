/**
 * Un justificatif déposé est-il un PDF ?
 *
 * Décidé sur l'EXTENSION, et c'est la seule information disponible : le type MIME n'est connu qu'au
 * moment du dépôt, alors que la valeur relue vient de la base. C'est suffisant parce que le serveur
 * a déjà croisé type et extension à l'entrée — `deplacerJustificatif` refuse tout le reste.
 *
 * La requête éventuelle est retirée avant l'examen : une URL peut porter un `?v=` pour contourner
 * un cache, et `…/facture.pdf?v=3` est bien un PDF.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. La règle était recopiée à trois endroits — la trésorerie, le
 * téléverseur générique et le justificatif d'artiste — et les trois ne faisaient pas la même chose
 * du résultat : deux affichaient le PDF dans une `iframe`, le troisième l'ouvrait dans un onglet.
 * Une règle recopiée l'est toujours plus de fois qu'annoncé, et ses copies finissent par diverger.
 */
export function estUnJustificatifPdf(url: string | null | undefined): boolean {
  return !!url?.toLowerCase().split('?')[0]?.endsWith('.pdf')
}
