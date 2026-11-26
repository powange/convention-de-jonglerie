/**
 * Comparer deux éditions qui n'ont pas eu lieu aux mêmes dates.
 *
 * Superposer deux éditions par leurs dates réelles n'a aucun sens : l'une s'est tenue en avril,
 * l'autre en mai, et les courbes ne se rencontreraient jamais. Ce qui se compare, c'est le
 * DÉCALAGE par rapport à l'ouverture — la veille de l'ouverture de 2025 se lit en face de la
 * veille de l'ouverture de 2026, quelle que soit la date de chacune.
 *
 * Chaque édition est donc recalée sur son propre premier jour, et l'axe cesse de porter des
 * dates pour porter des repères : J1 le jour de l'ouverture, J2 le lendemain, J-1 la veille.
 *
 * ⚠️ Il n'y a PAS de J0. Le jour de l'ouverture est J1, la veille est J-1 : on passe de -1 à 1
 * sans zéro, comme les années avant et après Jésus-Christ. Un décalage naïf produirait un J0
 * que personne ne sait lire, et décalerait d'un jour toute la moitié négative.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Le nombre de millisecondes dans une journée. */
const JOUR = 24 * 60 * 60 * 1000

/**
 * Le jour civil d'un instant, dans un fuseau donné, réduit à un nombre de jours depuis l'époque.
 *
 * On ne compare pas des instants mais des JOURS : deux éditions se comparent jour à jour, et
 * une vente à 23 h appartient au même jour qu'une vente à 1 h du matin. Le fuseau est celui du
 * lieu, parce que c'est le jour vécu sur place qui fait foi — une vente à 23 h à Paris est le
 * même jour pour l'organisateur, quelle que soit l'heure à Greenwich.
 */
function jourCivil(instant: Date, fuseau?: string): number {
  const formateur = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // `en-CA` rend « 2026-09-20 », qui se relit sans ambiguïté.
  const [annee, mois, jour] = formateur.format(instant).split('-').map(Number)
  return Math.floor(Date.UTC(annee!, mois! - 1, jour!) / JOUR)
}

/**
 * Les minutes écoulées dans la journée locale, pour un instant donné.
 *
 * Séparé du jour civil parce que les deux servent ensemble : le jour dit DE QUEL jour il s'agit,
 * les minutes disent OÙ l'on en est dans ce jour. C'est ce couple qui permet de comparer deux
 * éditions à une granularité plus fine que la journée.
 */
function minutesDansLaJournee(instant: Date, fuseau?: string): number {
  const formateur = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [heures, minutes] = formateur.format(instant).split(':').map(Number)
  // `en-GB` rend « 00:00 » à minuit, là où d'autres locales rendent « 24:00 ».
  return ((heures ?? 0) % 24) * 60 + (minutes ?? 0)
}

/**
 * Le CRÉNEAU d'un instant, compté depuis l'ouverture d'une édition.
 *
 * C'est le repère d'alignement réel, et il dépend de la granularité de l'écran : à une journée,
 * un créneau vaut un jour ; à douze heures, il y en a deux par jour ; à une heure, vingt-quatre.
 *
 * Une première version de ce recalage raisonnait uniquement en jours, et repliait donc toutes les
 * tranches d'une même journée sur un seul point — ce qui effaçait la granularité choisie et
 * donnait un graphique qui ne répondait plus au réglage. Le créneau corrige cela : les deux
 * éditions s'alignent à la finesse demandée, et le jour ne sert plus qu'à ÉTIQUETER.
 *
 * L'origine est minuit local du jour d'ouverture, et non l'instant exact de l'ouverture : les
 * tranches que le serveur découpe sont alignées sur l'horloge, pas sur une heure arbitraire.
 */
export function creneauDepuisOuverture(
  instant: Date | string | null | undefined,
  ouverture: Date | string | null | undefined,
  granulariteMinutes: number,
  fuseau?: string
): number | null {
  const quand = enDate(instant)
  const debut = enDate(ouverture)
  if (quand === null || debut === null) return null
  if (!Number.isFinite(granulariteMinutes) || granulariteMinutes <= 0) return null

  const jours = jourCivil(quand, fuseau) - jourCivil(debut, fuseau)
  const minutes = jours * 1440 + minutesDansLaJournee(quand, fuseau)
  return Math.floor(minutes / granulariteMinutes)
}

/**
 * Le repère de JOUR auquel appartient un créneau.
 *
 * Sert à étiqueter l'axe : plusieurs créneaux consécutifs portent le même jour, et c'est
 * exactement ce qu'on veut voir — « J-1 » couvrant ses deux colonnes quand la granularité est
 * de douze heures.
 */
export function jourDuCreneau(creneau: number, granulariteMinutes: number): number | null {
  if (!Number.isFinite(creneau) || !Number.isFinite(granulariteMinutes)) return null
  if (granulariteMinutes <= 0) return null
  const jours = Math.floor((creneau * granulariteMinutes) / 1440)
  return jours >= 0 ? jours + 1 : jours
}

/**
 * Les étiquettes d'un axe de créneaux : le jour, écrit UNE SEULE FOIS par journée.
 *
 * Répéter « J-1 » sous chacune de ses colonnes encombrerait l'axe sans rien apprendre. L'étiquette
 * apparaît au premier créneau de chaque journée, les suivants restent vides — l'œil regroupe.
 */
export function etiquettesDeCreneaux(
  creneaux: readonly number[],
  granulariteMinutes: number
): string[] {
  let dernierJour: number | null = null
  return creneaux.map((creneau) => {
    const jour = jourDuCreneau(creneau, granulariteMinutes)
    if (jour === null || jour === dernierJour) return ''
    dernierJour = jour
    return libelleDuRepere(jour)
  })
}

/**
 * Le repère d'un instant par rapport à l'ouverture d'une édition.
 *
 * Rend un entier **jamais nul** : `1` le jour de l'ouverture, `2` le lendemain, `-1` la veille.
 * `null` quand l'une des deux dates est illisible — mieux vaut un point absent qu'un point placé
 * au hasard sur un graphique qu'on va lire pour décider.
 */
export function repereDepuisOuverture(
  instant: Date | string | null | undefined,
  ouverture: Date | string | null | undefined,
  fuseau?: string
): number | null {
  const quand = enDate(instant)
  const debut = enDate(ouverture)
  if (quand === null || debut === null) return null

  const ecart = jourCivil(quand, fuseau) - jourCivil(debut, fuseau)
  // Pas de zéro : à partir du jour de l'ouverture on compte en positif, avant en négatif.
  return ecart >= 0 ? ecart + 1 : ecart
}

/** Une date lisible, ou `null` — une chaîne vide et une date invalide valent une absence. */
function enDate(valeur: Date | string | null | undefined): Date | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const date = valeur instanceof Date ? new Date(valeur.getTime()) : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Le libellé d'un repère, tel qu'il s'affiche sur un axe.
 *
 * « J1 », « J2 », « J-1 »… Court à dessein : un axe de graphique n'a pas la place d'une phrase,
 * et ces repères sont lus par dizaines côte à côte.
 */
export function libelleDuRepere(repere: number | null): string {
  if (repere === null || !Number.isFinite(repere) || repere === 0) return ''
  // Le signe est déjà porté par le nombre : « J-1 » s'écrit tout seul.
  return `J${repere}`
}

/**
 * Les repères communs à deux séries, dans l'ordre.
 *
 * L'union plutôt que l'intersection, et c'est le point : si l'édition passée a vendu dès J-90
 * et que la courante ne commence qu'à J-30, on veut VOIR que l'une a démarré plus tôt. Une
 * intersection effacerait précisément ce qu'on cherchait à comparer.
 *
 * Les deux séries sont ensuite alignées sur cet axe commun, chacune laissant un trou là où elle
 * n'a rien — un trou étant une information, contrairement à un zéro qui se lirait « aucune
 * vente ce jour-là ».
 */
export function axeCommun(a: readonly number[], b: readonly number[]): number[] {
  const tous = new Set<number>()
  // ⚠️ Le zéro n'est PAS écarté. Il n'existe pas parmi les repères de JOUR — il n'y a pas de J0 —
  // mais le CRÉNEAU zéro est parfaitement légitime : c'est la première tranche du jour
  // d'ouverture. Filtrer ici effaçait cette tranche, et décalait toute la journée d'ouverture.
  for (const r of a) if (Number.isFinite(r)) tous.add(r)
  for (const r of b) if (Number.isFinite(r)) tous.add(r)
  return [...tous].sort((x, y) => x - y)
}

/**
 * Une série replacée sur un axe commun.
 *
 * Rend `null` là où la série n'a pas de valeur — et non `0`. La distinction décide de la
 * lecture : un zéro affirme « rien n'a été vendu ce jour-là », un trou dit « cette édition
 * n'existait pas encore à ce stade ». C'est la même confusion « absence contre valeur » qui a
 * déjà coûté un chiffre faux ailleurs dans ce dépôt.
 */
export function alignerSurAxe(
  axe: readonly number[],
  reperes: readonly (number | null)[],
  valeurs: readonly number[]
): (number | null)[] {
  const parRepere = new Map<number, number>()
  reperes.forEach((repere, i) => {
    if (repere === null || !Number.isFinite(repere)) return
    const valeur = valeurs[i]
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return
    parRepere.set(repere, (parRepere.get(repere) ?? 0) + valeur)
  })
  return axe.map((repere) => (parRepere.has(repere) ? parRepere.get(repere)! : null))
}
