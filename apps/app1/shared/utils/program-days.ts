/**
 * Découpage d'une édition en journées.
 *
 * Sert à l'extraction du programme : le modèle est interrogé une journée à la fois, chaque appel
 * ne posant qu'une question plutôt que d'exiger le tri de neuf sections d'un coup.
 */

/** `2026-09-08T22:00:00.000Z` → `2026-09-08`, en heure locale de l'édition. */
function toDayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  // `toISOString` bascule en UTC et peut reculer d'un jour ; on lit les composantes directement.
  const mois = String(date.getUTCMonth() + 1).padStart(2, '0')
  const jour = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${mois}-${jour}`
}

/** Les jours couverts par l'édition, bornes comprises. */
export function editionDayKeys(startDate: Date | string, endDate: Date | string): string[] {
  const debut = typeof startDate === 'string' ? new Date(startDate) : startDate
  const fin = typeof endDate === 'string' ? new Date(endDate) : endDate
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) return []
  if (fin < debut) return []

  const jours: string[] = []
  const curseur = new Date(
    Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate())
  )
  const borne = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate())

  // Une édition très longue relèverait d'une erreur de saisie plutôt que d'une intention : on
  // s'arrête là plutôt que de produire des milliers de champs.
  while (curseur.getTime() <= borne && jours.length < 60) {
    jours.push(toDayKey(curseur))
    curseur.setUTCDate(curseur.getUTCDate() + 1)
  }
  return jours
}
