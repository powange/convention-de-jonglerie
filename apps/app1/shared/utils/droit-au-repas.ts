/**
 * Qui a droit à un repas, et qui n'y a pas droit.
 *
 * Une sélection porte `accepted` : `false` signifie que la personne a dit qu'elle ne prenait PAS
 * ce repas. Les écrans de validation l'ignoraient pour les bénévoles et les artistes — la
 * recherche les remontait, la liste d'attente les affichait, les compteurs les additionnaient, et
 * on pouvait les valider. Une artiste n'ayant que le vendredi soir ressortait ainsi sur le samedi
 * midi, et le repas lui était validé.
 *
 * L'incohérence était interne : dans ces mêmes points d'API, les ORGANISATEURS étaient déjà
 * filtrés (`NOT: { mealSelections: { some: { mealId, accepted: false } } }`). Les trois populations
 * suivent désormais la même règle.
 *
 * ⚠️ Le filtre ne suffit pas à lui seul : l'écriture doit refuser elle aussi. Masquer quelqu'un
 * d'une liste n'empêche pas une page restée ouverte de valider son identifiant — voir
 * la vérification à l'écriture.
 *
 * Le fichier vit dans `shared/` parce que la règle sert des deux côtés : le layer `meals` pour ses
 * points d'API, et `apps/app1` pour le port artistes. La dépendance va des layers vers l'app,
 * jamais l'inverse — un util de layer serait inaccessible au port.
 *
 * ## Les TROIS formes du droit au repas, et pourquoi elles coexistent
 *
 * Ce fichier a longtemps exporté une constante `SELECTION_ACCEPTEE = { accepted: true }`,
 * présentée comme « la condition Prisma commune à toutes les lectures de sélections ». Elle
 * n'était employée nulle part, et elle ne pouvait pas tenir cette promesse : il y a trois façons
 * de poser la question, et chacune est juste dans son contexte.
 *
 * 1. **`where: { accepted: true }`** — une vingtaine de lectures. « Quelles lignes disent oui ? »
 * 2. **`NOT: { mealSelections: { some: { mealId, accepted: false } } }`** — trois lectures
 *    (`pending.get`, `search.get`, `stats.get`). Question **différente** : « qui n'est pas
 *    exclu ? ». Elle inclut les personnes qui n'ont **aucune ligne** de sélection, ce que la
 *    première ne fait pas. C'est le motif des organisateurs, dont la sélection n'existe que pour
 *    enregistrer une exception.
 * 3. **`donneDroitAuRepas()`**, ci-dessous — en mémoire, sur un objet déjà chargé.
 *
 * Les formes 1 et 3 s'accordent parce que la colonne est `Boolean @default(true)`, **non
 * nullable** : il n'existe pas de `NULL` sur lequel elles pourraient diverger. La tolérance de la
 * forme 3 aux valeurs absentes n'est donc pas une divergence de règle, c'est une précaution
 * contre un `select` partiel qui n'aurait pas ramené le champ.
 *
 * ⚠️ `accepted: true` apparaît aussi dans des `select: { … }`, où il signifie « ramène cette
 * colonne » et non « filtre dessus ». Même chaîne, sens opposé : ne pas y toucher en croyant
 * uniformiser un filtre.
 */

/** Ce qu'il faut connaître d'une sélection pour juger du droit. */
export interface SelectionPourDroit {
  accepted?: boolean | null
}

/**
 * Cette sélection donne-t-elle droit au repas&nbsp;?
 *
 * `null` ou `undefined` valent OUI : le défaut du schéma est `true`, et une donnée manquante ne
 * doit pas priver quelqu'un de son repas devant la porte. Seul un refus explicite exclut.
 */
export function donneDroitAuRepas(selection: SelectionPourDroit | null | undefined): boolean {
  if (!selection) return false
  return selection.accepted !== false
}
