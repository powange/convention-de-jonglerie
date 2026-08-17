/**
 * Recalage des horaires extraits d'une image sur une journée choisie par l'organisateur.
 *
 * Une affiche d'ateliers n'indique souvent que des heures — « Jonglage 14 h », « Diabolo 16 h » —
 * sans dire de quel jour il s'agit. L'IA doit malgré tout produire des dates complètes, et le jour
 * qu'elle invente n'a aucune raison d'être le bon sur une édition qui en compte plusieurs.
 * L'organisateur désigne donc la journée, et ce module l'applique — plutôt que de s'en remettre au
 * modèle, qui suivrait la consigne la plupart du temps seulement.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 * Il ne manipule que des dates-heures **locales** sans fuseau (`AAAA-MM-JJTHH:MM[:SS]`), telles que
 * les rend l'IA et telles que les attend le formulaire ; l'ancrage dans le fuseau de l'édition a
 * lieu plus tard, au moment de l'enregistrement.
 */

/** `AAAA-MM-JJ` */
const FORMAT_JOURNEE = /^\d{4}-\d{2}-\d{2}$/
/** `AAAA-MM-JJTHH:MM` avec secondes et fraction facultatives, sans fuseau. */
const FORMAT_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/

export function estJourneeValide(journee: unknown): journee is string {
  if (typeof journee !== 'string' || !FORMAT_JOURNEE.test(journee)) return false
  // `2026-02-31` passe l'expression rationnelle mais n'existe pas : Date le reporterait au 3 mars.
  const [annee, mois, jour] = journee.split('-').map(Number)
  const d = new Date(Date.UTC(annee!, mois! - 1, jour!))
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois! - 1 && d.getUTCDate() === jour
}

/** Minutes écoulées depuis l'époque pour une date-heure locale, sans notion de fuseau. */
function minutesLocales(dateHeureLocale: string): number | null {
  const parts = FORMAT_LOCAL.exec(dateHeureLocale)
  if (!parts) return null
  const [annee, mois, jour] = parts[1]!.split('-').map(Number)
  const [heure, minute] = parts[2]!.split(':').map(Number)
  return Date.UTC(annee!, mois! - 1, jour!, heure!, minute!) / 60_000
}

/** Recompose une date-heure locale à partir de minutes depuis l'époque. */
function versLocal(minutes: number): string {
  const d = new Date(minutes * 60_000)
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}` +
    `T${deuxChiffres(d.getUTCHours())}:${deuxChiffres(d.getUTCMinutes())}:00`
  )
}

export interface CreneauLocal {
  startDateTime: string
  /** Facultative : une affiche ne donne souvent que l'heure de début. */
  endDateTime?: string | null
}

/**
 * Replace un créneau sur `journee`, en gardant ses heures et sa durée.
 *
 * La durée est reportée plutôt que la date de fin : un atelier de 23 h à 1 h doit rester à cheval
 * sur deux jours. Forcer les deux bornes sur la même journée le rendrait rétroactif, et il serait
 * écarté par la validation qui suit.
 *
 * Un créneau sans heure de fin est recalé sur son seul début, et le reste : rien n'est inventé.
 *
 * Renvoie `null` si le début est illisible, ou si une fin annoncée est illisible ou antérieure au
 * début — l'appelant écarte alors l'atelier, comme il le fait déjà pour les dates invalides.
 */
export function ancrerCreneauSurJournee(
  creneau: CreneauLocal,
  journee: string
): CreneauLocal | null {
  if (!estJourneeValide(journee)) return null

  const debut = minutesLocales(creneau.startDateTime)
  if (debut === null) return null

  const heureDebut = creneau.startDateTime.slice(11)
  const nouveauDebut = minutesLocales(`${journee}T${heureDebut}`)
  if (nouveauDebut === null) return null

  if (!creneau.endDateTime) {
    return { startDateTime: versLocal(nouveauDebut), endDateTime: null }
  }

  const fin = minutesLocales(creneau.endDateTime)
  if (fin === null) return null

  const duree = fin - debut
  if (duree <= 0) return null

  return {
    startDateTime: versLocal(nouveauDebut),
    endDateTime: versLocal(nouveauDebut + duree),
  }
}
