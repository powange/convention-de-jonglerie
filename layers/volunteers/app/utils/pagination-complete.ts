/**
 * Récupérer une liste paginée en entier, quand l'écran a besoin de TOUT.
 *
 * Le point d'API des candidatures pagine par 20 et plafonne à 100 par page. La page de planning
 * l'appelait sans rien préciser : elle ne recevait donc que les 20 premières candidatures
 * acceptées, et rien ne le signalait. Sur une édition de 42 acceptés, le calculateur d'effectif
 * annonçait 20 bénévoles, la moyenne d'heures était fausse, et les acceptés au-delà du vingtième
 * disparaissaient du relevé individuel s'ils ne tenaient aucun créneau.
 *
 * Demander simplement `pageSize=100` aurait déplacé le défaut au centième bénévole au lieu de le
 * corriger — et une troncature silencieuse est précisément ce qu'on répare ici.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/**
 * Au-delà, on cesse de demander.
 *
 * Le garde-fou ne vise pas les grosses éditions — 100 pages font 10 000 candidatures — mais un
 * total aberrant renvoyé par l'API, qui ferait tourner la boucle sans fin.
 */
const PAGES_MAX = 100

/**
 * Les numéros des pages restant à demander, la première ayant déjà été reçue.
 *
 * @param total     nombre total d'éléments, tel que l'API l'annonce
 * @param pageSize  taille de page effectivement demandée
 */
export function pagesRestantes(total: number, pageSize: number): number[] {
  if (!Number.isFinite(total) || !Number.isFinite(pageSize)) return []
  if (pageSize <= 0 || total <= pageSize) return []

  const dernierePage = Math.min(Math.ceil(total / pageSize), PAGES_MAX)

  return Array.from({ length: dernierePage - 1 }, (_, rang) => rang + 2)
}

/**
 * La liste est-elle incomplète après coup&nbsp;?
 *
 * Sert à ne pas se taire sur une troncature : mieux vaut une trace dans la console qu'un chiffre
 * faux affiché avec aplomb, qui est exactement ce qui s'est produit.
 */
export function listeTronquee(recus: number, total: number): boolean {
  if (!Number.isFinite(total) || !Number.isFinite(recus)) return false
  return recus < total
}
