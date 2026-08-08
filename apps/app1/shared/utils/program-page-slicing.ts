/**
 * Découpe une page de programme en sections journalières.
 *
 * Interroger le modèle une fois par journée donne d'excellents résultats, mais lui faire relire
 * toute la page à chaque fois est ruineux : neuf journées, c'était neuf lectures de 5 164
 * caractères pour en produire neuf extraits, soit deux minutes par journée.
 *
 * Or repérer où commence chaque journée ne demande aucune intelligence : les pages de programme
 * sont chronologiques et annoncent leurs journées par une date, un nom de jour ou un rang. Le
 * code s'en charge, gratuitement, et le modèle ne reçoit plus que la section qui le concerne.
 *
 * Le découpage est heuristique : quand une journée n'est pas localisée, on rend `null` et
 * l'appelant retombe sur la page entière. Mieux vaut une lecture lente qu'une section fausse.
 */

export interface JourneeARepererer {
  /** `2026-08-01` */
  date: string
  /** `samedi` */
  jourFr: string
  /** `Saturday` */
  jourEn: string
  /** Rang dans la convention, à partir de 1. */
  index: number
}

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

const MOIS_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

/**
 * Repères susceptibles d'annoncer une journée, du plus spécifique au plus ambigu.
 *
 * L'ordre compte : « 2026-08-01 » ne désigne qu'une journée, « samedi » peut revenir plusieurs
 * fois dans une convention de deux semaines. On tente les repères sûrs d'abord.
 */
function reperesDeLaJournee(jour: JourneeARepererer): string[] {
  const [annee, mois, jourDuMois] = jour.date.split('-')
  const numero = String(Number(jourDuMois))
  const moisIndex = Number(mois) - 1
  const moisFr = MOIS_FR[moisIndex] || ''
  const moisEn = MOIS_EN[moisIndex] || ''

  return [
    jour.date,
    `${jourDuMois}/${mois}/${annee}`,
    `${numero}/${mois}`,
    `${numero} ${moisFr}`,
    `${numero}er ${moisFr}`,
    `${moisEn} ${numero}`,
    `${numero} ${moisEn}`,
    `${moisEn} ${jourDuMois}`,
    `day ${jour.index}`,
    `jour ${jour.index}`,
    jour.jourFr,
    jour.jourEn,
  ].filter((r) => r && !r.includes('undefined'))
}

/**
 * Position de la journée dans la page, ou -1.
 *
 * La recherche démarre après la journée précédente : une page chronologique ne revient pas en
 * arrière, et cette contrainte écarte les faux positifs sur les noms de jours, qui reviennent
 * chaque semaine.
 */
function trouverPosition(page: string, jour: JourneeARepererer, depuis: number): number {
  for (const repere of reperesDeLaJournee(jour)) {
    const position = page.indexOf(repere.toLowerCase(), depuis)
    if (position !== -1) return position
  }
  return -1
}

/**
 * Rend, pour chaque journée, sa section de la page — ou `null` si elle n'a pas été localisée.
 *
 * Les clés sont les dates, dans l'ordre reçu.
 */
export function decouperParJournee(
  pageContent: string,
  journees: readonly JourneeARepererer[]
): Record<string, string | null> {
  const page = pageContent.toLowerCase()
  const sections: Record<string, string | null> = {}

  // Première passe : localiser chaque journée, en avançant dans la page.
  const positions: Array<{ date: string; position: number }> = []
  let curseur = 0
  for (const jour of journees) {
    const position = trouverPosition(page, jour, curseur)
    positions.push({ date: jour.date, position })
    if (position !== -1) curseur = position + 1
  }

  // Seconde passe : chaque section court jusqu'au repère suivant effectivement trouvé.
  for (let i = 0; i < positions.length; i++) {
    const courant = positions[i]!
    if (courant.position === -1) {
      sections[courant.date] = null
      continue
    }
    const suivant = positions.slice(i + 1).find((p) => p.position !== -1)
    const fin = suivant ? suivant.position : pageContent.length
    sections[courant.date] = pageContent.slice(courant.position, fin).trim()
  }

  return sections
}
