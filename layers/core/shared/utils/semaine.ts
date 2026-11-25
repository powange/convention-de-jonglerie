/**
 * Le jour où commence la semaine, selon la langue de qui regarde.
 *
 * Les calendriers du projet démarraient tous le dimanche — le défaut de la bibliothèque — alors
 * qu'en France la semaine commence le lundi. Un calendrier dont les colonnes ne sont pas à leur
 * place se lit de travers, et l'on clique à côté.
 *
 * Dérivé de la langue et non figé sur lundi : le projet en sert treize, et toutes ne commencent
 * pas la semaine le même jour. Mesuré sur l'environnement d'exécution — `fr`, `de`, `ru` et neuf
 * autres commencent le lundi ; `en` et `pt` commencent le dimanche. Coder « lundi » en dur aurait
 * corrigé le français en cassant l'anglais.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Tel que l'attend `UCalendar` : 0 pour dimanche, 1 pour lundi, jusqu'à 6 pour samedi. */
export type JourDeSemaine = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Lundi — le choix de repli, et celui de douze des treize langues du projet. */
export const LUNDI: JourDeSemaine = 1

/**
 * Le premier jour de la semaine pour une langue donnée.
 *
 * `Intl.Locale` porte l'information, sous deux noms selon les moteurs : `getWeekInfo()` d'un côté,
 * la propriété `weekInfo` de l'autre. Les deux sont interrogés, et l'on retombe sur lundi si
 * aucune ne répond — plutôt que sur le dimanche de la bibliothèque, qui est précisément ce qu'on
 * cherche à corriger.
 *
 * `firstDay` suit la numérotation ISO — 1 pour lundi, 7 pour dimanche — là où `UCalendar` attend
 * 0 pour dimanche. Le modulo fait la conversion, et lui seul : 7 devient 0, le reste ne bouge pas.
 */
export function premierJourDeSemaine(locale: string | null | undefined): JourDeSemaine {
  if (!locale) return LUNDI

  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number }
      weekInfo?: { firstDay?: number }
    }
    const premier = (intl.getWeekInfo?.() ?? intl.weekInfo)?.firstDay

    if (typeof premier !== 'number' || premier < 1 || premier > 7) return LUNDI
    return (premier % 7) as JourDeSemaine
  } catch {
    // Une étiquette de langue illisible ne doit pas casser l'affichage d'un calendrier.
    return LUNDI
  }
}
