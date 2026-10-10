/**
 * Les étiquettes de l'axe du graphique des achats, composées CHEZ LE LECTEUR.
 *
 * Le serveur les rendait toutes faites : « Lun 15/06 », via `setLocale('fr')` appliqué à des
 * instants lus sur la pendule du conteneur. Deux conséquences, dont aucune ne se voyait depuis
 * l'écran — la langue de l'axe était décidée par le serveur, et un achat passé à 0 h 30 sur place
 * portait la date de la veille. Il rend désormais des instants et le fuseau dans lequel il les a
 * découpés ; la mise en forme revient ici.
 *
 * ⚠️ POURQUOI UN UTIL PLUTÔT QUE QUATRE `if` DANS LE COMPOSANT. La forme de l'étiquette suit la
 * granularité, et c'est une règle : une tranche de douze heures a besoin de son heure, une tranche
 * d'un mois n'a que faire du jour de la semaine, et une tranche d'une semaine porte un MOT que
 * `toLocaleString` ne sait pas ajouter. Posée ici, la règle est éprouvée sans monter Chart.js.
 */
import { formaterJournee } from '~~/shared/utils/fuseau-edition'

/**
 * Les options de mise en forme d'une tranche, pour une granularité.
 *
 * `undefined` pour la semaine : elle ne se compose pas d'un seul `toLocaleString`, puisqu'elle est
 * précédée de « Semaine du ». Son format de date est rendu à part par `OPTIONS_DE_LA_SEMAINE`.
 */
const OPTIONS_PAR_GRANULARITE: Record<number, Intl.DateTimeFormatOptions> = {
  720: { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit' },
  1440: { weekday: 'short', day: '2-digit', month: '2-digit' },
  43200: { month: 'long', year: 'numeric' },
}

/** La date qui suit « Semaine du » : le jour et le mois, sans l'année ni le jour de la semaine. */
const OPTIONS_DE_LA_SEMAINE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }

/** Le jour, faute de mieux : une granularité inconnue vaut mieux lisible que vide. */
const OPTIONS_PAR_DEFAUT = OPTIONS_PAR_GRANULARITE[1440]!

/**
 * Les étiquettes d'un axe d'achats.
 *
 * `semaine` compose le libellé de la granularité hebdomadaire à partir de sa date — c'est la seule
 * des quatre formes qui porte un mot traduit, et l'injecter garde cet util hors de l'i18n, donc
 * éprouvable sans monter de composant. Absent, la date est rendue seule.
 */
export function etiquettesDesAchats(
  timestamps: readonly string[],
  granularite: number,
  fuseau?: string | null,
  locale = 'fr',
  semaine?: (date: string) => string
): string[] {
  return timestamps.map((instant) => {
    if (granularite === 10080) {
      const date = formaterJournee(instant, fuseau, locale, OPTIONS_DE_LA_SEMAINE)
      return semaine ? semaine(date) : date
    }
    return formaterJournee(
      instant,
      fuseau,
      locale,
      OPTIONS_PAR_GRANULARITE[granularite] ?? OPTIONS_PAR_DEFAUT
    )
  })
}
