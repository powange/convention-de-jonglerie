/**
 * Programme d'une édition, jour par jour.
 *
 * Un programme unique convenait mal à une convention qui dure plusieurs jours : le détail d'un
 * samedi n'a rien à voir avec celui d'un dimanche. Le champ général subsiste pour ce qui ne se
 * rattache à aucune date — plan d'accès, tarifs, principes de vie commune.
 */

/** Une journée saisie, telle que la base la connaît. */
export interface ProgramDayRecord {
  /** Jour concerné, au format `AAAA-MM-JJ`. */
  date: string
  content: string
}

/** Une journée proposée à l'affichage ou à la saisie. */
export interface ProgramDaySlot extends ProgramDayRecord {
  /**
   * Vrai quand ce jour ne tombe plus dans les dates de l'édition.
   *
   * Les dates d'une convention bougent — report, prolongation, correction de saisie. Le contenu
   * déjà écrit n'est alors pas effacé : le supprimer sans un mot ferait perdre du travail que
   * personne n'a demandé à jeter. Il est conservé et signalé.
   */
  outsideDates: boolean
}

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

/**
 * Assemble les jours à présenter : ceux de l'édition, plus ceux déjà écrits qui n'y tombent plus.
 *
 * Les seconds arrivent en fin de liste, signalés, plutôt que d'être perdus ou noyés au milieu.
 */
export function buildProgramDays(
  startDate: Date | string,
  endDate: Date | string,
  records: readonly ProgramDayRecord[]
): ProgramDaySlot[] {
  const parDate = new Map(records.map((r) => [r.date, r.content]))
  const jours = editionDayKeys(startDate, endDate)

  const slots: ProgramDaySlot[] = jours.map((date) => ({
    date,
    content: parDate.get(date) ?? '',
    outsideDates: false,
  }))

  const dansLEdition = new Set(jours)
  const orphelins = records
    .filter((r) => !dansLEdition.has(r.date) && r.content.trim() !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, content: r.content, outsideDates: true }))

  return [...slots, ...orphelins]
}
