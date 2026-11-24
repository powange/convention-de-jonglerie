/**
 * Le nom par lequel un courriel transactionnel salue quelqu'un.
 *
 * ## ⚠️ POURQUOI CET UTIL EXISTE : « Bonjour , » ET « Bonjour null, »
 *
 * `User.prenom` est `String?` en base — **31 comptes sur 454 n'en ont pas**, mesuré le 18/10/2026.
 * Or six gabarits de courriel déclarent `prenom: string` et rendent `Bonjour {{ prenom }},`. Trois
 * points d'API passaient la valeur brute, et le défaut sortait **différemment selon le corps** :
 *
 * | corps | ce que l'absence produit |
 * | --- | --- |
 * | HTML (interpolation Vue) | `Bonjour ,` — Vue rend `null` comme une chaîne vide |
 * | texte (gabarit littéral) | `Bonjour null,` — un littéral, lui, écrit le mot « null » |
 *
 * Le second est le plus visible, et c'est celui qu'on oublie : la réinitialisation de mot de passe
 * saluait correctement en HTML et écrivait « Bonjour null, » dans sa version texte, parce que le
 * repli avait été calculé puis pas réutilisé une ligne plus bas.
 *
 * 📍 Et le typage ne protégeait pas : `admin/users/[id].delete.ts` écrivait `prenom || ''`, ce qui
 * **fait taire l'erreur en produisant le défaut**. Une valeur de repli qui rend la salutation vide
 * n'est pas un repli.
 *
 * ## Pourquoi `pseudo`
 *
 * `User.pseudo` est `String @unique`, donc **jamais nul** : c'est le seul nom dont on soit sûr.
 * Le dépôt employait déjà ce repli à la main, de quatre façons différentes (`|| pseudo`,
 * `|| pseudo || 'Utilisateur'`, `|| ''`). D'où cet util : une seule définition, pour que le
 * prochain appelant ne le réécrive pas de travers.
 *
 * @example
 * ```ts
 * const salutation = nomDeSalutation(user) // « Jean », ou son pseudo s'il n'a pas de prénom
 * text: `Bonjour ${salutation}, …`
 * ```
 */
export function nomDeSalutation(personne: {
  prenom?: string | null
  pseudo?: string | null
}): string {
  // Le prénom peut aussi être une chaîne vide ou blanche — un `|| pseudo` seul la laisserait
  // passer sur `''`, mais pas sur `'   '`, qui donnerait « Bonjour    , ».
  const prenom = personne.prenom?.trim()
  if (prenom) return prenom

  const pseudo = personne.pseudo?.trim()
  if (pseudo) return pseudo

  /*
   * Inatteignable avec un `User` chargé depuis la base, `pseudo` y étant non nul. Ce dernier
   * recours existe pour les appelants qui ne sélectionnent pas `pseudo` : mieux vaut un mot
   * générique qu'une salutation amputée, et le type n'oblige personne à le prévoir.
   */
  return 'à vous'
}
