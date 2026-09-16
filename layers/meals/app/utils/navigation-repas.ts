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
