import { z } from 'zod'

/**
 * Ce qu'est un lien externe acceptable, en un seul endroit.
 *
 * La règle vivait en double, et les deux copies ne disaient pas la même chose. Le réglage du
 * bénévolat écartait les protocoles dangereux ; les deux points d'API d'appel à spectacles se
 * contentaient d'un `z.string().url()` nu. Or `url()` ne juge que la forme : mesuré, il accepte
 * `javascript:alert(1)`, `data:text/html,<script>…` et `file:///etc/passwd`. Le lien d'un appel à
 * spectacles est affiché aux candidats — c'est donc un lien qu'on leur propose de suivre.
 *
 * Et côté formulaire, rien ne vérifiait quoi que ce soit : « juggling.fr » partait au serveur, qui
 * le refusait. La même famille de défaut que le téléphone d'une candidature, réglée de la même
 * façon — une règle, lue des deux côtés.
 *
 * Ce module ne dépend ni du réseau ni de la base : il se teste sur des chaînes.
 */

/** Au-delà, ce n'est plus un lien qu'on colle mais une charge utile. */
export const URL_EXTERNE_MAX = 1000

/** Les seuls protocoles qu'on propose de suivre. */
const PROTOCOLES_AUTORISES = ['http:', 'https:']

/**
 * Vrai si la saisie est un lien que le serveur acceptera.
 *
 * Le protocole se lit sur l'URL analysée, et non par comparaison de préfixe : `HtTpS://…` est
 * valable, et un contrôle sur le texte brut doit penser à la casse — une chose de plus à ne pas
 * oublier dans la deuxième copie.
 */
export function estUrlExterne(valeur: string | null | undefined): boolean {
  const v = (valeur ?? '').trim()
  if (!v || v.length > URL_EXTERNE_MAX) return false
  let analysee: URL
  try {
    analysee = new URL(v)
  } catch {
    return false
  }
  if (!PROTOCOLES_AUTORISES.includes(analysee.protocol)) return false
  // « https:// » seul est une URL valable au sens de la norme, et ne mène nulle part.
  return analysee.hostname.length > 0
}

/** Le schéma qui fait foi. Il rend le lien élagué, prêt à être enregistré. */
export const schemaUrlExterne = z
  .string()
  .trim()
  .max(URL_EXTERNE_MAX, `URL trop longue (max ${URL_EXTERNE_MAX} caractères)`)
  .refine(estUrlExterne, 'URL invalide — seuls les liens HTTP et HTTPS sont acceptés')

/**
 * Le lien tel qu'il faut l'envoyer : élagué, ou `null` s'il n'est pas valable.
 *
 * Évite le couple « je vérifie une chaîne, j'en envoie une autre », qui laissait passer une saisie
 * entourée d'espaces.
 */
export function urlExterneNormalisee(valeur: string | null | undefined): string | null {
  const resultat = schemaUrlExterne.safeParse(valeur ?? '')
  return resultat.success ? resultat.data : null
}
