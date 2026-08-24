/**
 * Lecture des refus de validation renvoyés par l'API.
 *
 * `handleValidationError` répond `createError({ status: 400, message: 'Données invalides',
 * data: { errors } })`. h3 sérialise cela en `{ statusCode, message, data: { errors } }`, et
 * ofetch place tout le corps dans `error.data` : le détail par champ se trouve donc en
 * `error.data.data.errors`, à deux niveaux et non à un.
 *
 * Ce piège a déjà coûté un aller-retour : lire `error.data.errors` rend `undefined` sans
 * broncher, le formulaire n'affiche aucun marqueur, et le refus paraît venir de nulle part.
 * Le second chemin reste accepté — quelques points d'API répondent à plat.
 */
export function extraireErreursChamps(erreur: any): Record<string, string> | null {
  const brut = erreur?.data?.data?.errors ?? erreur?.data?.errors
  if (!brut || typeof brut !== 'object') return null
  const utiles = Object.entries(brut).filter(([, valeur]) => typeof valeur === 'string')
  return utiles.length ? (Object.fromEntries(utiles) as Record<string, string>) : null
}

/**
 * Le message à montrer : le détail par champ s'il existe, sinon celui de l'API.
 *
 * « Données invalides » seul ne dit rien de ce qu'il faut reprendre.
 */
export function messageErreurValidation(
  erreur: any,
  champs: Record<string, string> | null,
  repli: string
): string {
  if (champs) return Object.values(champs).join(' · ')
  return erreur?.data?.message || erreur?.message || repli
}
