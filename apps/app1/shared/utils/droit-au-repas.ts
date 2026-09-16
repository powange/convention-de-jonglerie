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
 */

/** La condition Prisma commune à toutes les lectures de sélections. */
export const SELECTION_ACCEPTEE = { accepted: true } as const

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
