import { journeeDans } from './fuseau-edition'

/**
 * Les filtres d'échéance des tâches, découpés à l'heure de l'ÉDITION — constat B4.
 *
 * ## Le défaut
 *
 * Une échéance se saisit et s'affiche à l'heure du lieu (`TaskModal`, `fuseauEdition`). Mais les
 * deux écrans qui la filtrent construisaient « aujourd'hui » avec
 * `new Date(now.getFullYear(), now.getMonth(), now.getDate())`, puis comparaient le jour de
 * l'échéance **dans le fuseau du navigateur**. Pour un organisateur qui suit depuis ailleurs, une
 * tâche affichée « 12 oct. » pouvait tomber **hors** du filtre « aujourd'hui », ou basculer d'un
 * jour dans « 7 prochains jours » : l'écran montrait une date et le filtre en lisait une autre.
 *
 * ## Pourquoi un util, et pourquoi il est PUR
 *
 * La règle était **recopiée à l'identique** dans les deux écrans — « mes tâches » et le tableau
 * d'un groupe —, ce qui est précisément pourquoi le défaut était identique des deux côtés. Et
 * seule une fonction pure permet de l'éprouver : un filtre de dates ne se relit pas, il se mesure
 * autour de minuit, depuis deux fuseaux éloignés.
 *
 * ## 📍 POURQUOI CE FICHIER VIT DANS `shared/utils` ET NON DANS LE LAYER `tasks`
 *
 * La fiche proposait `layers/tasks/app/utils/`. Deux raisons l'en écartent, et la seconde est la
 * plus contraignante : il lit `journeeDans`, qui vit dans `shared/utils` — depuis un layer,
 * l'import passerait par l'alias `~~`, que le projet de tests `unit` ne résout pas (il tourne hors
 * Nuxt). Le fichier y serait donc intestable, ou bien il recopierait le découpage des journées,
 * c'est-à-dire exactement la duplication que ce lot vient défaire. Ici, l'import est relatif, et
 * les deux écrans — l'un dans `apps/app1`, l'autre dans le layer — l'atteignent par le même `~~`.
 *
 * ## ⚠️ CE QUE CE LOT NE TOUCHE PAS
 *
 * Le rappel serveur (`task-deadlines-reminders.ts`) découpe **encore autrement** : au jour du
 * serveur. Il reste donc un troisième découpage du même jour, hors du périmètre de ce lot — la
 * fiche le demande explicitement. Ne pas croire l'affaire close pour autant.
 */

/** Les valeurs que l'écran propose. `all` ne filtre rien. */
export type FiltreEcheance = 'all' | 'overdue' | 'today' | 'next7' | 'next30' | 'none'

/** Ce qu'une tâche doit porter pour être filtrée : son échéance et son statut, rien de plus. */
export interface TacheFiltrableParEcheance {
  deadline: string | null
  status: string
}

/** Les statuts qui retirent une tâche du « en retard » : elle est close, le délai n'a plus de sens. */
const STATUTS_CLOS = ['DONE', 'CANCELLED']

/**
 * Une journée `AAAA-MM-JJ` décalée de `jours`.
 *
 * ⚠️ Arithmétique de CALENDRIER, et non d'instants : on avance sur des numéros de jour, donc les
 * nuits de changement d'heure — 23 ou 25 heures — n'y décalent rien. C'est la raison pour laquelle
 * le calcul part de la journée déjà résolue sur place, et non d'un instant auquel on ajouterait
 * `n × 24 h`.
 */
function journeeDecalee(journee: string, jours: number): string {
  const [annee, mois, jour] = journee.split('-').map((n) => parseInt(n, 10))
  if (!annee || !mois || !jour) return ''
  const t = Date.UTC(annee, mois - 1, jour) + jours * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Une tâche passe-t-elle le filtre d'échéance demandé ? */
export function correspondAuFiltreEcheance(
  tache: TacheFiltrableParEcheance,
  filtre: FiltreEcheance,
  maintenant: Date,
  fuseau?: string | null
): boolean {
  if (filtre === 'all') return true
  if (filtre === 'none') return tache.deadline === null
  if (!tache.deadline) return false

  /*
   * ⚠️ « EN RETARD » NE SE DÉCOUPE PAS EN JOURNÉES, et c'est volontaire : la question est « ce
   * moment est-il passé ? », à quoi deux instants répondent sans qu'aucun fuseau n'intervienne.
   * Le ramener au jour rendrait « en retard » une tâche due ce soir à 23 h.
   */
  if (filtre === 'overdue') {
    return new Date(tache.deadline) < maintenant && !STATUTS_CLOS.includes(tache.status)
  }

  const journeeDeLEcheance = journeeDans(tache.deadline, fuseau)
  const aujourdhui = journeeDans(maintenant, fuseau)
  // Une date illisible n'entre dans aucune fenêtre : mieux vaut l'absence qu'une tâche rangée au
  // hasard dans « aujourd'hui ».
  if (!journeeDeLEcheance || !aujourdhui) return false

  if (filtre === 'today') return journeeDeLEcheance === aujourdhui

  /*
   * Les fenêtres partent du DÉBUT d'aujourd'hui et vont jusqu'à la FIN du septième (ou trentième)
   * jour — comportement d'avant ce lot, conservé tel quel. Deux conséquences à connaître : une
   * échéance déjà dépassée **ce matin** figure dans « 7 prochains jours », et la fenêtre couvre
   * huit journées calendaires, non sept.
   *
   * 📍 Les journées se comparent comme des CHAÎNES : `AAAA-MM-JJ` s'ordonne lexicographiquement
   * dans le même sens que le calendrier. Il n'y a donc aucun instant de borne à fabriquer — et
   * c'était précisément la fabrication de ces bornes qui lisait le fuseau du navigateur.
   */
  if (filtre === 'next7' || filtre === 'next30') {
    const derniere = journeeDecalee(aujourdhui, filtre === 'next7' ? 7 : 30)
    return Boolean(derniere) && journeeDeLEcheance >= aujourdhui && journeeDeLEcheance <= derniere
  }

  return true
}

/** La liste filtrée, dans son ordre d'origine. */
export function filtrerParEcheance<T extends TacheFiltrableParEcheance>(
  taches: T[],
  filtre: FiltreEcheance,
  maintenant: Date,
  fuseau?: string | null
): T[] {
  if (filtre === 'all') return taches
  return taches.filter((t) => correspondAuFiltreEcheance(t, filtre, maintenant, fuseau))
}
