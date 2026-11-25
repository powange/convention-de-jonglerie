import { isValidPhoneNumber } from 'libphonenumber-js'

/**
 * Ce qu'est un téléphone acceptable sur une candidature — la règle, en un seul endroit.
 *
 * Elle vivait côté serveur uniquement, et le formulaire se contentait de vérifier que le champ
 * n'était pas vide. Les deux ne disaient donc pas la même chose : le champ à indicatif émet
 * toujours quelque chose — « 123 » devient `+33123` —, le formulaire l'acceptait, et le serveur
 * répondait « Numéro de téléphone invalide ». Le journal d'erreurs de production en porte la
 * trace, assez souvent pour que ces refus aient été classés « bruit attendu ».
 *
 * Partagée plutôt que recopiée : une seconde règle écrite côté client aurait divergé de la
 * première, ce qui est exactement le défaut qu'on corrige, déplacé d'un cran.
 *
 * ⚠️ Ce module ne doit dépendre que de `libphonenumber-js`. Il est chargé aussi bien par le
 * serveur que par le navigateur et par les tests unitaires hors Nuxt.
 */

/** Les caractères admis, et la longueur — ce que la saisie doit avoir l'air d'être. */
export const FORME_TELEPHONE = /^[+0-9 ().-]{6,30}$/
export const TELEPHONE_MIN = 6
export const TELEPHONE_MAX = 30

/**
 * Un numéro réellement valide, et pas seulement de la bonne forme.
 *
 * Ne regarder que les caractères employés laissait passer un numéro français à huit chiffres, et
 * la candidature partait avec un téléphone injoignable — constaté. `libphonenumber` connaît les
 * longueurs et les préfixes réellement attribués, pays par pays ; c'est lui qui tranche.
 *
 * Le repli en France couvre les versions antérieures de l'application encore en cache sur un
 * téléphone : elles envoient le numéro au format national. Il n'élargit rien par rapport à
 * l'ancien contrôle, qui acceptait déjà `0712345678`.
 */
export function telephoneCandidatureValide(valeur: string): boolean {
  const v = valeur.trim()
  if (!v) return false
  return v.startsWith('+') ? isValidPhoneNumber(v) : isValidPhoneNumber(v, 'FR')
}

/**
 * Le verdict complet, tel que le point d'API le rendra — forme, longueur, puis validité.
 *
 * C'est cette fonction que le formulaire interroge, et non `telephoneCandidatureValide` seule :
 * le schéma du serveur pose d'abord une contrainte de forme, et un numéro collé depuis un carnet
 * de contacts échoue là avant même d'être analysé. Le formulaire doit refuser les mêmes.
 */
export function telephoneCandidatureAcceptable(valeur: string): boolean {
  // Sur la valeur BRUTE, et non sur sa version rognée : le schéma du serveur mesure et contrôle la
  // chaîne telle qu'elle arrive, et ne rogne qu'au moment d'analyser le numéro. Rogner ici d'abord
  // ferait accepter, aux bornes, ce que le serveur refuserait — la divergence qu'on supprime.
  if (valeur.length < TELEPHONE_MIN || valeur.length > TELEPHONE_MAX) return false
  if (!FORME_TELEPHONE.test(valeur)) return false
  return telephoneCandidatureValide(valeur)
}
