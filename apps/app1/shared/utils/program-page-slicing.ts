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
 * Repères de pied de page.
 *
 * La dernière journée d'une convention n'a pas de repère suivant : sa section court jusqu'au bout
 * de la page et emporte crédits, copyright et mentions légales. Un modèle à qui l'on demande de
 * recopier fidèlement recopie alors « Designed and built with ❤️ by Andrej » comme s'il
 * s'agissait du programme du dimanche.
 */
const MARQUEURS_DE_PIED = [
  '©',
  'copyright',
  'all rights reserved',
  'tous droits réservés',
  'designed and built',
  'powered by',
  'mentions légales',
  'privacy policy',
  'politique de confidentialité',
  // « cookie » et « designed by » seuls seraient trop larges : un atelier « Cookie decorating »
  // ou un « show designed by » sont des lignes de programme plausibles, et couper là ferait
  // perdre tout le reste de la journée.
  'cookie policy',
  'politique de cookies',
  'paramètres des cookies',
]

/**
 * Avertissements adressés au lecteur de la page, et non au participant d'une journée.
 *
 * Ils ne sont cherchés que dans la DERNIÈRE section — la seule qui s'étende jusqu'au bout de la
 * page faute de repère suivant. Les chercher partout serait dangereux : une journée dont le
 * programme réel mentionnerait « horaires subject to change » perdrait tout ce qui suit cette
 * ligne. Le risque n'est acceptable que là où le bruit est certain.
 */
const MARQUEURS_AVERTISSEMENT = [
  'reserve the right',
  'subject to change',
  'still under development',
  'sous réserve de modification',
  'susceptible de modification',
  'peut encore changer',
  'programme prévisionnel',
]

/** Recule jusqu'au début de la ligne contenant `position`. */
function debutDeLigne(texte: string, position: number): number {
  const precedent = texte.lastIndexOf('\n', position - 1)
  return precedent === -1 ? 0 : precedent + 1
}

/**
 * Une ligne porte-t-elle un horaire ?
 *
 * C'est ce qui distingue un en-tête de journée — « 📅 Sunday, August 2nd » — d'une ligne de
 * programme qui commencerait par la même chose : « Monday — from 10:00 | Goodbye ».
 */
function porteUnHoraire(ligne: string): boolean {
  return /\d{1,2}\s*[:h]\s*\d{2}/.test(ligne)
}

/**
 * Retire l'en-tête de journée en tête de section.
 *
 * « 📅 SATURDAY, August 1st » n'est pas du programme : c'est le repère qui a servi à trouver la
 * section. Mais « Monday — départ à 14h » l'est, et la même ligne porte alors le titre ET le
 * contenu.
 *
 * On ne retire donc la première ligne que s'il n'en reste rien une fois ôtés les repères du jour
 * et la ponctuation d'usage. Un horaire suffit également à la conserver.
 */
function retirerEnTete(section: string, reperes: readonly string[]): string {
  const saut = section.indexOf('\n')
  if (saut === -1) return section

  const premiere = section.slice(0, saut)
  if (porteUnHoraire(premiere)) return section

  let reste = premiere.toLowerCase()
  // Du plus long au plus court : retirer « august » avant « aug » éviterait de laisser « ust ».
  for (const repere of [...reperes].sort((x, y) => y.length - x.length)) {
    reste = reste.split(repere.toLowerCase()).join(' ')
  }
  // Ponctuation, ordinaux anglais et décorations qui accompagnent les titres de journée.
  reste = reste
    .replace(/\b(st|nd|rd|th)\b/g, ' ')
    .replace(/[\d\s,.;:—–\-|/()[\]]/g, '')
    .replace(/[^\p{L}]/gu, '')

  return reste.length === 0 ? section.slice(saut + 1).trim() : section
}

/**
 * Coupe une section au premier signe de pied de page.
 *
 * Jamais sur la première ligne : une section qui commencerait par un tel marqueur n'aurait pas
 * été localisée là par hasard, et la vider ferait perdre la journée entière.
 */
function couperAvantLePied(section: string, derniereSection: boolean): string {
  const marqueurs = derniereSection
    ? [...MARQUEURS_DE_PIED, ...MARQUEURS_AVERTISSEMENT]
    : MARQUEURS_DE_PIED
  const lignes = section.split('\n')
  const index = lignes.findIndex((ligne, i) => {
    if (i === 0) return false
    const normalisee = ligne.toLowerCase()
    return marqueurs.some((marqueur) => normalisee.includes(marqueur))
  })
  return index === -1 ? section : lignes.slice(0, index).join('\n').trim()
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
    // Bornes ramenées au début de leur ligne : couper à la position exacte du repère laissait le
    // début de l'en-tête suivant — « 📅 Sunday, » — accroché à la fin de la section précédente.
    const debut = debutDeLigne(pageContent, courant.position)
    const fin = suivant ? debutDeLigne(pageContent, suivant.position) : pageContent.length
    const jour = journees.find((j) => j.date === courant.date)!
    sections[courant.date] = couperAvantLePied(
      retirerEnTete(pageContent.slice(debut, fin).trim(), reperesDeLaJournee(jour)),
      !suivant
    )
  }

  return sections
}
