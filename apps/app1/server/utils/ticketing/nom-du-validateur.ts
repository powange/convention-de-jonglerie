/**
 * « Qui a validé cette entrée ? » — posée une fois, pour les quatre populations.
 *
 * Cette règle était écrite **neuf fois**, sous trois formes : un `findUnique` par personne dans
 * trois branches de `verify`, un `findMany` suivi d'une `Map` dans quatre endroits de `search` et
 * de `verify`, et une neuvième copie dans `mouvement-de-validation.ts`. Toutes rendaient le même
 * objet `{ firstName, lastName }`, et aucune ne le rendait tout à fait pareil.
 *
 * Elle a produit le même défaut **deux fois**, à un jour d'intervalle : la branche billet de
 * `verify` ne renvoyait pas l'auteur (constat B2), puis celle de `search` non plus — et personne
 * ne l'avait vu, parce que corriger un point d'API ne fait pas regarder l'autre.
 *
 * C'est le seul morceau du constat A3 dont l'extraction valait la peine. Le **squelette** des
 * quatre populations, lui, reste en place délibérément : elles diffèrent sur leurs trois entrées
 * à la fois — le modèle, le critère de portée et la forme de la réponse — si bien qu'un
 * dispatcher générique serait le même code avec une indirection, et cette indirection rendrait
 * moins visible la classe de bug du champ Prisma inexistant.
 *
 * ⚠️ Une dixième lecture existe, dans `recent-validations.get.ts`, et elle ne doit **pas** être
 * repliée ici : elle charge le pseudo, l'avatar et l'empreinte de courriel pour afficher une
 * vignette, là où les neuf autres veulent un prénom et un nom pour une étiquette. L'y ramener
 * ferait charger sept colonnes à tous les appelants qui en demandent deux. C'est une vraie
 * différence, pas une recopie — et c'est exactement la distinction que le constat A3 demandait
 * de faire.
 */

/** Le nom d'un validateur tel que l'interface l'attend, dans les quatre populations. */
export interface NomDeValidateur {
  firstName: string | null
  lastName: string | null
}

/**
 * Résout les noms des validateurs en **une seule requête**, et rend de quoi les relire.
 *
 * L'appelant passe tous les identifiants qu'il aura à nommer — y compris `null` et `undefined`,
 * qui sont le cas courant d'une entrée jamais validée — et reçoit une fonction de lecture. Une
 * commande peut porter dix billets validés par des personnes différentes : les résoudre un par un
 * coûtait dix allers-retours, et c'est la raison pour laquelle la forme rendue est une fonction
 * plutôt qu'un simple nom.
 *
 * Un identifiant dont l'utilisateur n'existe plus rend `null`, comme un identifiant absent : à la
 * lecture, un compte supprimé et une entrée non validée se disent de la même façon, et rien ne
 * doit faire échouer l'affichage d'une fiche pour autant.
 */
export async function resoudreLesValidateurs(
  identifiants: Array<number | null | undefined>
): Promise<(id: number | null | undefined) => NomDeValidateur | null> {
  const ids = [...new Set(identifiants.filter((id): id is number => typeof id === 'number'))]

  const utilisateurs = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, prenom: true, nom: true },
      })
    : []

  const parId = new Map(utilisateurs.map((u) => [u.id, u]))

  return (id) => {
    const u = typeof id === 'number' ? parId.get(id) : undefined
    return u ? { firstName: u.prenom, lastName: u.nom } : null
  }
}
