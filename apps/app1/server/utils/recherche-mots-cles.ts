/**
 * Recherche d'une personne par mots-clés.
 *
 * La recherche comparait la saisie entière à chaque champ pris isolément. « Omer » trouvait,
 * « Emma » aussi, mais « omer emma » ne trouvait rien — aucun champ ne contient les deux — et un
 * simple espace en fin de saisie suffisait à tout faire disparaître.
 *
 * On découpe donc la saisie en mots, et l'on exige que **chacun** se retrouve dans **au moins un**
 * champ. L'ordre n'a plus d'importance : « emma omer » vaut « omer emma ».
 */

/**
 * Réduit un texte à sa forme comparable : sans accent, sans casse, sans espaces superflus.
 *
 * Les accents sont retirés des deux côtés de la comparaison — chercher « jerome » doit trouver
 * « Jérôme », sans quoi le premier signalement suivant porterait là-dessus.
 */
export function normaliserPourRecherche(valeur: string | null | undefined): string {
  return (valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Les mots-clés d'une saisie : découpés sur les espaces, normalisés, les vides écartés.
 *
 * Rend une liste vide pour une saisie qui ne porte aucun mot — c'est ce qui distingue « rien à
 * chercher » de « rien ne correspond », et l'appelant doit trancher lui-même ce qu'il en fait.
 */
export function motsClesDeLaRequete(requete: string | null | undefined): string[] {
  return normaliserPourRecherche(requete)
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
}

/**
 * Une personne correspond-elle à tous les mots-clés cherchés ?
 *
 * Chaque mot doit se retrouver quelque part — nom, prénom, pseudo, e-mail —, mais pas
 * nécessairement dans le même champ : c'est ce qui fait marcher « omer emma » sur un nom et un
 * prénom séparés.
 *
 * Sans aucun mot-clé, rien ne correspond : une saisie vide ne doit pas rendre tout le monde.
 */
export function correspondAuxMotsCles(
  champs: Array<string | null | undefined>,
  motsCles: string[]
): boolean {
  if (motsCles.length === 0) return false

  const valeurs = champs.map(normaliserPourRecherche).filter((valeur) => valeur.length > 0)

  return motsCles.every((mot) => valeurs.some((valeur) => valeur.includes(mot)))
}
