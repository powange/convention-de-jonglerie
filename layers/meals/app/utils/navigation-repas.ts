/**
 * Choisir un repas par son JOUR puis par son TYPE, plutôt que dans une liste unique.
 *
 * Une édition tient le plus souvent sur un week-end : trois jours, trois repas, soit neuf entrées
 * — une douzaine avec le montage et le démontage. La liste déroulante n'était pas illisible, mais
 * elle demandait de viser une ligne dans un menu, sur un téléphone, devant une file d'attente.
 *
 * Le mouvement réel n'est pas « aller au samedi midi » : c'est « passer au repas suivant », ou
 * « le dîner du même jour ». D'où des flèches pour le jour et trois boutons pour le type.
 *
 * ⚠️ La grille n'est PAS complète. Le jour de montage ne porte souvent que le dîner : proposer
 * « jeudi + petit-déjeuner » désignerait un repas qui n'existe pas, et l'écran resterait vide.
 * C'est tout l'objet de ce module.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** L'ordre dans lequel les repas se succèdent dans une journée. */
export const TYPES_DE_REPAS = ['BREAKFAST', 'LUNCH', 'DINNER'] as const

export type TypeDeRepas = (typeof TYPES_DE_REPAS)[number]

/** Ce qu'il faut connaître d'un repas pour naviguer entre eux. */
export interface RepasNavigable {
  id: number
  /** Date-heure du repas, telle que l'API la rend. */
  date: string
  mealType: string
}

/** La journée d'un repas, `AAAA-MM-JJ`, en heure locale comme l'écran l'affiche. */
export function jourDuRepas(repas: RepasNavigable): string {
  const date = new Date(repas.date)
  if (!Number.isFinite(date.getTime())) return ''
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
}

/** Les journées portant au moins un repas, dans l'ordre chronologique. */
export function journeesDesRepas(repas: readonly RepasNavigable[]): string[] {
  const jours = new Set<string>()
  for (const unRepas of repas) {
    const jour = jourDuRepas(unRepas)
    if (jour) jours.add(jour)
  }
  return [...jours].sort()
}

/**
 * Les types réellement configurés ce jour-là, dans l'ordre de la journée.
 *
 * C'est cette liste qui dit quels boutons proposer : un type absent ne doit pas être offert, sans
 * quoi on désignerait un repas inexistant.
 */
export function typesDuJour(repas: readonly RepasNavigable[], jour: string): string[] {
  const presents = new Set(
    repas.filter((unRepas) => jourDuRepas(unRepas) === jour).map((unRepas) => unRepas.mealType)
  )
  const connus = TYPES_DE_REPAS.filter((type) => presents.has(type))
  // Un type hors des trois attendus — une collation, par exemple — reste proposé plutôt
  // qu'escamoté : mieux vaut un bouton de plus qu'un repas qu'on ne peut plus atteindre.
  const autres = [...presents].filter(
    (type) => !(TYPES_DE_REPAS as readonly string[]).includes(type)
  )
  return [...connus, ...autres.sort()]
}

/** Le repas d'un jour et d'un type donnés, ou `null` s'il n'existe pas. */
export function repasDuJour(
  repas: readonly RepasNavigable[],
  jour: string,
  type: string
): RepasNavigable | null {
  return repas.find((unRepas) => jourDuRepas(unRepas) === jour && unRepas.mealType === type) ?? null
}

/**
 * La journée voisine, ou `null` au bout.
 *
 * `null` plutôt que de boucler : passer du dimanche au jeudi d'un clic de flèche surprendrait, et
 * c'est ce qui permet de griser le bouton aux extrémités.
 */
export function journeeVoisine(
  journees: readonly string[],
  jourCourant: string,
  sens: 1 | -1
): string | null {
  const rang = journees.indexOf(jourCourant)
  if (rang === -1) return null
  return journees[rang + sens] ?? null
}

/**
 * Les heures de bascule d'un type de repas au suivant, sur place.
 *
 * Avant 11 h on sert le petit-déjeuner, avant 15 h le déjeuner, ensuite le dîner. Ce sont des
 * bornes de service et non des heures de repas : à 14 h 30 la file du déjeuner existe encore, à
 * 15 h 30 on prépare le soir.
 */
export const AVANT_DEJEUNER = 11
export const AVANT_DINER = 15

/** Le type de repas qu'on sert à cette heure-là, sur place. */
export function typeSelonLHeure(heure: number): TypeDeRepas {
  if (heure < AVANT_DEJEUNER) return 'BREAKFAST'
  if (heure < AVANT_DINER) return 'LUNCH'
  return 'DINNER'
}

/**
 * Le repas à présenter d'emblée au comptoir, quand aucun n'est demandé par l'URL.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. L'écran choisissait son repas par deux comparaisons
 * d'instants : une fenêtre de ±3 h autour de « maintenant », puis un repli sur « le premier repas
 * à venir ». Les deux échouaient, et pour la MÊME raison : un repas est stocké à **minuit UTC** du
 * jour où il est servi, son heure de service n'existe nulle part. La fenêtre de ±3 h ne rencontrait
 * donc jamais un déjeuner ni un dîner, et — c'est le vrai coupable — un dîner « minuit UTC » est
 * déjà passé dès 2 h du matin sur place : à midi, plus aucun repas du jour n'était « à venir », et
 * le comptoir ouvrait sur **le lendemain**. Corriger la seule fenêtre aurait laissé le défaut
 * entier.
 *
 * D'où un choix par JOURNÉE puis par TYPE, comme le reste de ce module : les seules données fiables
 * sont la journée du repas et son type.
 *
 * ⚠️ `aujourdhui` et `heure` sont reçus en paramètres, et ce n'est pas un détail de style : ce
 * fichier ne doit rien importer (voir l'en-tête), alors que les résoudre demande le fuseau de
 * l'édition. C'est donc l'appelant qui les calcule — `journeeDans` et `heureDans` de
 * `shared/utils/fuseau-edition.ts` — et cette fonction reste pure, donc testable à date fixe.
 */
export function repasParDefaut(
  repas: readonly RepasNavigable[],
  aujourdhui: string,
  heure: number
): RepasNavigable | null {
  const journees = journeesDesRepas(repas)
  if (journees.length === 0) return null

  // Le cas courant, et le seul qui compte pendant l'événement : on sert aujourd'hui.
  if (journees.includes(aujourdhui)) {
    return repasEnChangeantDeJour(repas, aujourdhui, typeSelonLHeure(heure))
  }

  /*
   * Hors des journées de repas — la veille en préparant le comptoir, ou après coup en relisant les
   * chiffres. On ouvre alors au plus près : le premier repas à venir, sinon le dernier servi.
   */
  const aVenir = journees.find((jour) => jour > aujourdhui)
  if (aVenir) return repasEnChangeantDeJour(repas, aVenir, null)

  const derniereJournee = journees[journees.length - 1]!
  const types = typesDuJour(repas, derniereJournee)
  // Le DERNIER repas de la dernière journée, et non le premier : après l'événement, ce qu'on
  // rouvre est ce qui vient de se passer.
  return repasDuJour(repas, derniereJournee, types[types.length - 1]!)
}

/**
 * Le repas à retenir quand on change de journée.
 *
 * On garde le MÊME type si ce jour-là le propose — passer du déjeuner de samedi au déjeuner de
 * dimanche est le geste attendu. Sinon on prend le premier repas de la journée plutôt que de ne
 * rien sélectionner : une flèche qui vide l'écran donnerait l'impression d'un défaut.
 */
export function repasEnChangeantDeJour(
  repas: readonly RepasNavigable[],
  jour: string,
  typeSouhaite: string | null
): RepasNavigable | null {
  if (typeSouhaite) {
    const memeType = repasDuJour(repas, jour, typeSouhaite)
    if (memeType) return memeType
  }
  const premier = typesDuJour(repas, jour)[0]
  return premier ? repasDuJour(repas, jour, premier) : null
}
