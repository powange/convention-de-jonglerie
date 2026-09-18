/**
 * Les recherches textuelles de la liste du matériel : par nom, et par lieu d'emprunt.
 *
 * Regroupées ici parce qu'elles partagent la même façon de comparer — accents et casse ignorés,
 * saisie découpée en mots.
 *
 * La normalisation elle-même a déménagé dans `shared/` : le module Tâches en avait besoin et ne
 * peut pas dépendre de celui-ci. C'est exactement le « deux copies finissent toujours par diverger
 * sur un caractère » que cet en-tête annonçait, une couche plus haut. Elle est réexportée pour les
 * appelants qui la prenaient ici.
 */

import { motsDeLaRequete, normaliserTexte } from '~~/shared/utils/recherche-texte'

export { motsDeLaRequete, normaliserTexte }

/** Le champ contient-il tous les mots cherchés ? */
function contientTousLesMots(champ: string | null | undefined, mots: string[]): boolean {
  const valeur = normaliserTexte(champ)
  return mots.every((mot) => valeur.includes(mot))
}

/**
 * Le matériel dont le nom contient tous les mots cherchés, dans un ordre quelconque.
 *
 * Le nom seul, pas la description : on cherche « rallonge » pour trouver une rallonge, et la
 * remonter parce qu'une autre fiche la mentionne en passant brouillerait le résultat.
 *
 * Sans mot cherché, rien n'est filtré.
 */
export function filtrerParNom<T extends { name?: string | null }>(
  objets: T[],
  requete: string
): T[] {
  const mots = motsDeLaRequete(requete)
  if (mots.length === 0) return objets

  return objets.filter((objet) => contientTousLesMots(objet.name, mots))
}

/** Un matériel, réduit à ses deux lieux. */
export interface LieuxEmprunt {
  pickupLocation?: string | null
  returnLocation?: string | null
}

/**
 * Le matériel dont l'un des deux lieux contient tous les mots cherchés.
 *
 * Récupération et retour sont fouillés ensemble : on cherche « où ai-je affaire à Marie ? » sans
 * savoir d'avance si c'est pour aller chercher ou pour rapporter.
 *
 * Le rapprochement se fait champ par champ : « gymnase marie » ne doit pas remonter un objet dont
 * la récupération dit « Gymnase » et le retour « Chez Marie », qui sont deux adresses distinctes.
 *
 * Une recherche libre plutôt qu'une liste de lieux existants : ce sont des textes saisis à la
 * main, et « Chez Marie » côtoiera « chez Marie, 12 rue des Lilas » dans la même édition.
 */
export function filtrerParLieuEmprunt<T extends LieuxEmprunt>(objets: T[], requete: string): T[] {
  const mots = motsDeLaRequete(requete)
  if (mots.length === 0) return objets

  return objets.filter((objet) =>
    [objet.pickupLocation, objet.returnLocation].some(
      (lieu) => normaliserTexte(lieu).length > 0 && contientTousLesMots(lieu, mots)
    )
  )
}
