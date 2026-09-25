/**
 * Les couleurs dont un module de gestion peut se réclamer, et leurs classes.
 *
 * Elles vivaient dans deux tables écrites à la main au cœur de `ManagementNavigationCard`, qui
 * n'en connaissait que onze — alors que l'accueil de gestion en passait quatorze. Les cinq
 * inconnues (`cyan`, `violet`, `emerald`, `rose`, `sky`) donnaient `undefined` à la recherche, la
 * classe devenait `p-2 rounded-lg undefined`, et la carte s'affichait SANS COULEUR. Aucune erreur,
 * aucun avertissement : mesuré à l'écran, `general-info`, `external-links` et `features` avaient un
 * fond transparent et une icône en gris de texte.
 *
 * Le type fait désormais foi : une couleur hors de cette liste ne compile plus, là où elle passait
 * en silence.
 *
 * ⚠️ Les classes sont écrites EN TOUTES LETTRES, jamais composées par interpolation. Tailwind lit
 * les sources pour décider de ce qu'il génère : une classe construite à l'exécution n'existerait
 * pas dans la feuille de style, et l'on retomberait sur le même défaut par un autre chemin.
 */
export const COULEURS_DE_MODULE = [
  'indigo',
  'blue',
  'green',
  'purple',
  'orange',
  'yellow',
  'gray',
  'warning',
  'error',
  'teal',
  'amber',
  'cyan',
  'violet',
  'emerald',
  'rose',
  'sky',
] as const

export type CouleurDeModule = (typeof COULEURS_DE_MODULE)[number]

/** Le fond de la pastille qui porte l'icône, sur les cartes de l'accueil. */
export const FOND_DE_MODULE: Record<CouleurDeModule, string> = {
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30',
  green: 'bg-green-100 dark:bg-green-900/30',
  purple: 'bg-purple-100 dark:bg-purple-900/30',
  orange: 'bg-orange-100 dark:bg-orange-900/30',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
  gray: 'bg-gray-100 dark:bg-gray-900/30',
  warning: 'bg-amber-100 dark:bg-amber-900/30',
  error: 'bg-red-100 dark:bg-red-900/30',
  teal: 'bg-teal-100 dark:bg-teal-900/30',
  amber: 'bg-amber-100 dark:bg-amber-900/30',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30',
  violet: 'bg-violet-100 dark:bg-violet-900/30',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30',
  rose: 'bg-rose-100 dark:bg-rose-900/30',
  sky: 'bg-sky-100 dark:bg-sky-900/30',
}

/** La couleur de l'icône elle-même — sur une carte comme dans le titre de la page du module. */
export const ICONE_DE_MODULE: Record<CouleurDeModule, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400',
  orange: 'text-orange-600 dark:text-orange-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  gray: 'text-gray-600 dark:text-gray-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  teal: 'text-teal-600 dark:text-teal-400',
  amber: 'text-amber-600 dark:text-amber-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  violet: 'text-violet-600 dark:text-violet-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
  sky: 'text-sky-600 dark:text-sky-400',
}
