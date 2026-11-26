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

/** `'user.pseudo'` devient `{ user: { pseudo: { contains: mot } } }`. */
function conditionSurChamp(chemin: string, mot: string): Record<string, unknown> {
  let condition: Record<string, unknown> = { contains: mot }
  for (const segment of chemin.split('.').reverse()) {
    condition = { [segment]: condition }
  }
  return condition
}

/**
 * Les endroits où un mot-clé peut se trouver, à mettre dans un `OR` Prisma.
 *
 * Les listes paginées en SQL ne peuvent pas passer par [correspondAuxMotsCles] : filtrer après
 * chargement ne filtrerait que la page courante, et le total annoncé serait celui d'avant le
 * filtre. Il faut donc traduire les mots-clés en conditions, et c'est à la base de faire la
 * comparaison — elle l'a en `utf8mb4_unicode_ci`, qui ignore déjà casse et accents.
 *
 * Un chemin peut traverser une relation : `'user.nom'` autant que `'nom'`.
 */
export function alternativesMotCle(
  mot: string,
  champs: readonly string[]
): Record<string, unknown>[] {
  return champs.map((champ) => conditionSurChamp(champ, mot))
}

/**
 * Les conditions d'une recherche par mots-clés : **chaque** mot dans **au moins un** champ.
 *
 * Rend une liste vide sans mot-clé, à joindre telle quelle au `AND` de l'appelant — une saisie
 * vide ne filtre donc rien, là où [correspondAuxMotsCles] ne rend personne. La différence est
 * voulue : côté base, on part de tout le monde et on retranche.
 */
export function conditionsMotsCles(
  motsCles: string[],
  champs: readonly string[]
): Record<string, unknown>[] {
  return motsCles.map((mot) => ({ OR: alternativesMotCle(mot, champs) }))
}
