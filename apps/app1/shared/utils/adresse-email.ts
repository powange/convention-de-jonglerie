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

/**
 * La boîte de réception réellement visée, quand deux adresses écrites différemment y mènent.
 *
 * « Jean.Dupont@Gmail.com », « jeandupont@gmail.com » et « jean.dupont+asso@googlemail.com »
 * sont trois
 * chaînes distinctes — donc trois lignes possibles en base, `email` étant unique — pour un seul
 * destinataire. C'est ainsi que naît un double compte sans que personne ne l'ait voulu.
 *
 * Trois règles, de la plus sûre à la moins :
 *
 * - la **casse** ne compte jamais, c'est le standard ;
 * - le **sous-adressage** `+quelquechose` est coupé partout. Un `+` littéral dans une adresse
 *   réelle existe en théorie ; en pratique il désigne un alias, et l'écran montre les deux
 *   adresses côte à côte pour qu'un humain tranche ;
 * - les **points du nom local** ne sont retirés que chez Google, seul fournisseur courant à les
 *   ignorer. Ailleurs, `jean.dupont@` et `jeandupont@` sont deux personnes différentes, et les
 *   confondre accuserait à tort.
 *
 * Rend `null` si l'adresse n'est pas valable : rien à rapprocher.
 */
export function cleDeBoiteDeReception(valeur: string | null | undefined): string | null {
  const adresse = adresseEmailNormalisee(valeur)?.toLowerCase()
  if (!adresse) return null

  const separateur = adresse.lastIndexOf('@')
  const domaine = adresse.slice(separateur + 1)
  let local = adresse.slice(0, separateur)

  const plus = local.indexOf('+')
  if (plus !== -1) local = local.slice(0, plus)

  // googlemail.com est un ancien nom de gmail.com : même boîte, même traitement.
  const chezGoogle = domaine === 'gmail.com' || domaine === 'googlemail.com'
  if (chezGoogle) local = local.replaceAll('.', '')

  // Un nom local vidé par le découpage (« +alias@… ») ne désigne plus rien de comparable.
  if (!local) return null

  return `${local}@${chezGoogle ? 'gmail.com' : domaine}`
}
