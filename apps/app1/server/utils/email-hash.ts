import md5 from 'md5'

import { sanitizeEmail } from './validation-helpers'

/**
 * Le hachage MD5 d'une adresse, pour Gravatar.
 *
 * ## ⚠️ IL Y AVAIT UN CACHE, ET IL EST RETIRÉ (constat A9)
 *
 * Une `Map` au niveau du module gardait chaque adresse rencontrée, **sans expiration ni plafond**.
 * Toute adresse jamais affichée — participants, bénévoles, listes d'administration, fusions de
 * comptes — y restait jusqu'au redémarrage. Deux coûts : une fuite lente, et une **copie en clair
 * de toutes les adresses vues** dans le tas du processus.
 *
 * ⚠️ ET SA CLÉ ÉTAIT L'ADRESSE BRUTE, alors que le hachage porte sur l'adresse normalisée.
 * « Foo@x.fr » et « foo@x.fr » occupaient donc **deux entrées** pour un seul et même MD5 : le cache
 * grandissait plus vite que le nombre d'adresses distinctes.
 *
 * Tout cela pour économiser un MD5 sur une chaîne de trente caractères, qui se calcule en quelques
 * microsecondes. Un cache n'est pas gratuit : il faut une borne, une éviction et une clé juste —
 * ici, les trois coûtaient plus que ce qu'ils faisaient gagner.
 */
export function getEmailHash(email: string): string {
  if (!email) return ''
  return md5(sanitizeEmail(email))
}
