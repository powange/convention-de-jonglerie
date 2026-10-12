/**
 * Dédoublonner une liste d'associations sur sa clé d'unicité — constat O3.
 *
 * ## Le défaut
 *
 * Sous MySQL, **deux NULL sont distincts dans un index unique**. Une contrainte
 * `@@unique([customFieldId, handoutItemId, choiceValue])` dont `choiceValue` est nullable
 * **n'empêche donc pas** d'empiler deux lignes « tous les choix » identiques. Ce qu'elle semble
 * garantir, elle ne le garantit pas.
 *
 * Prouvé en base plutôt que déduit, dans une transaction annulée ensuite :
 *
 * ```
 * create { customFieldId: 1, handoutItemId: 1, choiceValue: null }  → id 80
 * create { customFieldId: 1, handoutItemId: 1, choiceValue: null }  → id 81
 * ```
 *
 * ## 📊 L'ÉTENDUE MESURÉE, qui n'est pas celle de la fiche
 *
 * Huit contraintes relèvent du « NULL = tous » (cf. `unicite-sur-colonne-nullable.test.ts`), mais
 * **la plupart des chemins d'écriture étaient déjà protégés** — chacun à sa façon, et chacun avec
 * son commentaire expliquant le piège MySQL :
 *
 * | table | chemin | protection |
 * | --- | --- | --- |
 * | les 3 tables de quotas de personnes | `remplacerLesQuotas` | `new Set(quotaIds)` |
 * | articles des bénévoles / organisateurs | `normalizeHandoutItemSelections` | `Map` par article |
 * | quotas d'un champ personnalisé (1 point sur 3) | `quotas.put.ts` | clé écrite à la main |
 * | `ShowArtist` | `show-acts.ts`, `import-performer` | `new Set` / `findFirst` |
 *
 * **Quatre écritures ne l'étaient pas**, toutes sur les deux tables de liaison d'un champ
 * personnalisé : la création d'un champ, sa modification, et les deux points dédiés aux articles
 * à remettre. Elles versaient le corps de la requête tel quel dans `createMany`.
 *
 * ## Pourquoi un helper, pour quinze lignes
 *
 * La règle existait déjà **trois fois**, écrite à la main de trois façons différentes (un `Set`
 * d'identifiants, une `Map`, une clé composée). C'est exactement ce qu'on recopie « juste une
 * fois » et qui diverge au premier correctif appliqué d'un seul côté — et ici la divergence
 * existait déjà : la version de `quotas.put.ts` gardait la **première** occurrence, celle de
 * `normalizeHandoutItemSelections` la **dernière**.
 *
 * ## ⚠️ CE QUE CECI NE FAIT PAS
 *
 * Il ne protège que d'un doublon **dans une même requête**. Deux requêtes simultanées peuvent
 * encore s'entrelacer : c'est la limite assumée de la garde applicative, et la raison pour
 * laquelle tous ces chemins font aussi un `deleteMany` avant leur `createMany`, dans une
 * transaction. Le choix a été tranché contre une valeur sentinelle (migration de données **et**
 * réécriture de toutes les lectures qui testent `null`) et contre une colonne générée indexée
 * (que Prisma ne gère pas).
 */

/** Ce dont une clé peut être faite. `null` et `undefined` y désignent la même chose : « tous ». */
export type MorceauDeCle = string | number | boolean | null | undefined

/**
 * La liste sans ses doublons de clé.
 *
 * ⚠️ **C'est la DERNIÈRE occurrence qui gagne, à la position de la première.** Un formulaire qui
 * envoie deux fois le même article avec deux quantités veut dire la seconde — c'est déjà le
 * comportement de `normalizeHandoutItemSelections`, et garder la première rendrait la saisie
 * imprévisible selon le point d'API touché.
 *
 * La clé passe par `JSON.stringify` et non par une concaténation : `['', null]` et `[null, '']`
 * doivent se distinguer, et un `?? ''` — ce que faisait la version écrite à la main —
 * confondrait « tous les choix » (NULL) avec le choix vide.
 */
export function dedoublonnerAssociations<T>(
  liste: readonly T[],
  cle: (element: T) => ReadonlyArray<MorceauDeCle>
): T[] {
  const parCle = new Map<string, T>()
  for (const element of liste) {
    // `?? null` : `undefined` disparaîtrait de la sérialisation d'un tableau JSON en `null` de
    // toute façon, mais l'écrire évite de dépendre de ce détail.
    parCle.set(JSON.stringify(cle(element).map((morceau) => morceau ?? null)), element)
  }
  return [...parCle.values()]
}
