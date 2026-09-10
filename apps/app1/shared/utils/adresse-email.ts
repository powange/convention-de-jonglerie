import { z } from 'zod'

/**
 * Ce qu'est une adresse e-mail valable, en un seul endroit.
 *
 * La règle était jusqu'ici recopiée dix-sept fois sous la forme
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, tandis que les points d'API la vérifiaient avec `zod`. Les deux
 * ne disent pas la même chose, et l'écart se voyait en production : la recherche d'un responsable
 * d'emprunt émettait un appel que l'interface jugeait valable et que le serveur refusait, laissant
 * une erreur 400 au journal pour un résultat que l'utilisateur voyait simplement vide.
 *
 * Cinq formes passaient l'expression et non `zod` — `a@b..com`, `jean@exemple.fr.`,
 * `jean..dupont@exemple.fr`, `jean@-exemple.fr`, `jean@exemple..fr` — auxquelles s'ajoutent les
 * domaines à extension d'une seule lettre (`a@b.c`). Deux copies d'une même règle finissent
 * toujours par diverger : d'où ce module, dont dépendent désormais le serveur comme l'interface.
 *
 * Les espaces qui entourent la saisie ne comptent pas. C'était déjà l'intention du serveur, qui
 * élaguait l'adresse après l'avoir validée — donc trop tard pour une saisie collée avec un espace
 * de trop, refusée alors qu'un simple élagage l'aurait sauvée.
 *
 * Ce module ne dépend ni du réseau ni de la base : il se teste sur des chaînes.
 */

/** Le schéma qui fait foi. Il rend l'adresse élaguée, prête à être envoyée. */
export const schemaAdresseEmail = z.string().trim().pipe(z.email())

/**
 * Vrai si la saisie est une adresse que le serveur acceptera.
 *
 * À utiliser avant d'appeler `/api/users/search` et partout où l'interface décide si une adresse
 * « a l'air bonne » : c'est la même règle des deux côtés, il n'y a plus de « bonne ici, mauvaise
 * là-bas ».
 */
export function estAdresseEmail(valeur: string | null | undefined): boolean {
  return schemaAdresseEmail.safeParse(valeur ?? '').success
}

/**
 * L'adresse telle qu'il faut l'envoyer : élaguée, ou `null` si elle n'est pas valable.
 *
 * Évite le couple « je vérifie une chaîne, j'en envoie une autre » — c'est précisément ce qui
 * laissait passer une saisie entourée d'espaces.
 */
export function adresseEmailNormalisee(valeur: string | null | undefined): string | null {
  const resultat = schemaAdresseEmail.safeParse(valeur ?? '')
  return resultat.success ? resultat.data : null
}
