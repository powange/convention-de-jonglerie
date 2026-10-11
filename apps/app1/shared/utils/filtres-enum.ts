/**
 * Filtrer une liste sur une colonne d'énumération, sans faire tomber la requête — constat B8.
 *
 * ## Le défaut
 *
 * Deux écrans d'administration recopiaient un paramètre d'URL directement dans le `where` Prisma
 * d'une colonne `enum`. Mesuré sur la base de développement :
 *
 * ```
 * feedback type=PIZZA      → PrismaClientValidationError : Invalid value for argument `type`.
 * notification type=PIZZA  → PrismaClientValidationError : Invalid value for argument `type`.
 * ```
 *
 * Prisma rejette **la requête entière** : la liste ne répond plus rien, l'écran reste vide, et le
 * journal d'erreurs se remplit d'un 500 qui ressemble à une panne alors qu'un paramètre de trop
 * suffisait. Le filtre voisin, `status`, était déjà gardé — six lignes au-dessus, dans le même
 * fichier.
 *
 * ## Ignorer plutôt que refuser, et pourquoi
 *
 * Une valeur inconnue est **ignorée** : la liste répond sans ce filtre. C'est le comportement que
 * `status` avait déjà, et un 400 casserait les liens déjà en circulation — une adresse mise en
 * favori avec un statut d'une version antérieure cesserait de répondre. Ce dépôt a déjà payé ce
 * durcissement deux fois.
 *
 * ⚠️ Le revers est assumé : qui demande un filtre inconnu voit **tout**, sans que rien ne le dise.
 * C'est moins trompeur qu'une page blanche, et les écrans n'envoient que des valeurs d'une liste
 * déroulante — une valeur inconnue vient d'une adresse écrite à la main.
 */

/** Les valeurs de `FeedbackType`. */
export const TYPES_DE_RETOUR = ['BUG', 'SUGGESTION', 'GENERAL', 'COMPLAINT'] as const

/** Les valeurs de `FeedbackStatus`. */
export const STATUTS_DE_RETOUR = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const

/** Les valeurs de `NotificationType`. */
export const TYPES_DE_NOTIFICATION = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'] as const

/**
 * La valeur si elle appartient à l'énumération, `undefined` sinon.
 *
 * `unknown` en entrée, et non `string` : `getQuery` rend un **tableau** quand le paramètre
 * apparaît deux fois dans l'adresse (`?type=BUG&type=BUG`), et un tableau recopié dans un `where`
 * fait lever Prisma exactement comme une valeur inconnue.
 *
 * 📍 Le `typeof brut === 'string'` ne porte PAS cette protection, et c'est un sabotage qui l'a
 * montré : le retirer ne change aucun comportement, parce que `includes` compare à l'identique et
 * rejette déjà un tableau. Il est là pour que le rétrécissement vers `T` soit *constaté* plutôt
 * qu'affirmé par une assertion de type — pas pour écarter un cas que la comparaison laisserait
 * passer. Ne pas lui prêter plus que cela.
 */
export function valeurDEnumeration<T extends string>(
  valeursConnues: readonly T[],
  brut: unknown
): T | undefined {
  return typeof brut === 'string' && (valeursConnues as readonly string[]).includes(brut)
    ? (brut as T)
    : undefined
}
