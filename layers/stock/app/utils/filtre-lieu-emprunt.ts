/**
 * La recherche sur les lieux d'un emprunt.
 *
 * Récupération et retour sont fouillés ensemble : on cherche « où ai-je affaire à Marie ? » sans
 * savoir d'avance si c'est pour aller chercher ou pour rapporter.
 *
 * Une recherche libre plutôt qu'une liste de lieux existants : ce sont des textes saisis à la
 * main, et « Chez Marie » côtoiera « chez Marie, 12 rue des Lilas » dans la même édition. Une
 * liste déroulante les tiendrait pour deux lieux distincts.
 */

/** Un matériel, réduit à ses deux lieux. */
export interface LieuxEmprunt {
  pickupLocation?: string | null
  returnLocation?: string | null
}

/** Réduit un texte à sa forme comparable : sans accent, sans casse, sans espaces superflus. */
function normaliser(valeur: string | null | undefined): string {
  return (valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Les objets dont l'un des deux lieux contient tous les mots cherchés.
 *
 * Chaque mot doit se retrouver, mais pas nécessairement dans le même champ que les autres :
 * chercher « marie lilas » trouve un lieu de récupération qui les porte tous deux, et non un
 * objet dont la récupération dit « Marie » et le retour « Lilas ». Le rapprochement se fait donc
 * champ par champ.
 *
 * Sans mot cherché, rien n'est filtré.
 */
export function filtrerParLieuEmprunt<T extends LieuxEmprunt>(objets: T[], requete: string): T[] {
  const mots = normaliser(requete)
    .split(/\s+/)
    .filter((mot) => mot.length > 0)

  if (mots.length === 0) return objets

  return objets.filter((objet) => {
    const lieux = [objet.pickupLocation, objet.returnLocation].map(normaliser).filter(Boolean)
    return lieux.some((lieu) => mots.every((mot) => lieu.includes(mot)))
  })
}
