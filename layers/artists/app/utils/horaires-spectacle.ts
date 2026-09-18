/**
 * Quand un passage se termine.
 *
 * La durée appartient à l'ŒUVRE et l'horaire au PASSAGE : un spectacle joué deux fois dure aussi
 * longtemps les deux soirs, mais ne finit pas à la même heure. La fin ne peut donc pas se ranger à
 * côté de la durée — elle se calcule pour chaque représentation, et c'est pourquoi une colonne
 * « heure de fin » porte autant de valeurs que la colonne des horaires.
 *
 * ⚠️ Le calcul porte sur l'INSTANT, jamais sur une heure lue. Ajouter 90 minutes à un instant
 * traverse correctement un changement d'heure — la nuit du passage à l'heure d'hiver, un spectacle
 * commencé à 2h30 finit à 3h00 affichées alors qu'une heure s'est écoulée dans les faits, et c'est
 * bien ce qu'on veut annoncer au public. Manipuler des heures locales aurait demandé de savoir dans
 * quel fuseau, question à laquelle ce fichier n'a pas à répondre : le formatage s'en charge, ici on
 * ne fait qu'avancer d'une durée.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Combien de millisecondes dans une minute — nommé pour qu'un `60000` nu ne se relise pas. */
const MS_PAR_MINUTE = 60_000

/**
 * L'instant où le passage s'achève, ou `null` quand la question ne se pose pas.
 *
 * `null` plutôt qu'une date approximative dans trois cas, tous réels :
 * - **aucune durée saisie** — la majorité des spectacles avant que le programme soit bouclé. Rien
 *   ne permet de deviner une fin, et en inventer une la ferait passer pour une information ;
 * - **une durée nulle ou négative**, qu'un import ou une faute de frappe peut produire : une fin
 *   antérieure au début se lirait comme un bug de l'affichage plutôt que comme une saisie à
 *   corriger ;
 * - **une date de début illisible**, pour la même raison.
 */
export function finDeRepresentation(
  debut: string | Date | null | undefined,
  dureeEnMinutes: number | null | undefined
): Date | null {
  if (debut == null) return null
  if (typeof dureeEnMinutes !== 'number' || !Number.isFinite(dureeEnMinutes)) return null
  if (dureeEnMinutes <= 0) return null

  const instantDeDebut = debut instanceof Date ? debut.getTime() : new Date(debut).getTime()
  if (!Number.isFinite(instantDeDebut)) return null

  return new Date(instantDeDebut + dureeEnMinutes * MS_PAR_MINUTE)
}
