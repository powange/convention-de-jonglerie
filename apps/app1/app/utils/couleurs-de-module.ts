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

/**
 * La couleur de l'icône d'un lien de navigation, appliquée depuis le lien lui-même.
 *
 * Pourquoi ce détour plutôt que la table ci-dessus : dans la barre latérale de la gestion, 36 des
 * 46 entrées sont des **sous-entrées**, et `NavigationMenuChildItem` retire justement `ui` de ce
 * qu'une entrée peut porter (`Omit<NavigationMenuItem, 'type' | 'ui'>`). Une sous-entrée n'a donc
 * aucun moyen de styler sa propre icône — seulement une `class` sur son lien. La variante va la
 * chercher depuis là, et vaut pour les deux niveaux : un seul mécanisme, au lieu d'un par
 * profondeur.
 *
 * ⚠️ On vise `data-slot`, PAS une position. Une première version ciblait `[&>:first-child]`, le
 * premier enfant du lien. C'était juste — sauf pour les entrées à compteur : elles reçoivent un
 * `chip`, Nuxt UI enveloppe alors l'icône, et le premier enfant devient cette enveloppe. La couleur
 * allait donc sur l'enveloppe, tandis que l'icône gardait celle du thème — grise en clair, presque
 * blanche en sombre.
 *
 * Le défaut ne touchait que les entrées signalant quelque chose à traiter : candidatures, commandes,
 * validation des repas. Trois modules verts, d'où le symptôme tel qu'il a été rapporté — « celles
 * qui devraient être vertes sont grises ». Aucune de mes mesures ne le voyait, l'édition de test
 * n'ayant rien en attente, donc aucune pastille.
 *
 * `data-slot` couvre les deux cas — l'icône le porte qu'elle soit enveloppée ou non — et ne colore
 * pas le point de la pastille, dont la couleur signale l'urgence.
 *
 * ⚠️ Classes écrites en toutes lettres, comme les autres. Tailwind lit les sources pour décider de
 * ce qu'il génère ; une variante composée à l'exécution n'existerait pas dans la feuille de style.
 */
export const ICONE_DE_MODULE_DANS_UN_LIEN: Record<CouleurDeModule, string> = {
  indigo:
    '[&_[data-slot=linkLeadingIcon]]:text-indigo-600 [&_[data-slot=childLinkIcon]]:text-indigo-600 dark:[&_[data-slot=linkLeadingIcon]]:text-indigo-400 dark:[&_[data-slot=childLinkIcon]]:text-indigo-400',
  blue: '[&_[data-slot=linkLeadingIcon]]:text-blue-600 [&_[data-slot=childLinkIcon]]:text-blue-600 dark:[&_[data-slot=linkLeadingIcon]]:text-blue-400 dark:[&_[data-slot=childLinkIcon]]:text-blue-400',
  green:
    '[&_[data-slot=linkLeadingIcon]]:text-green-600 [&_[data-slot=childLinkIcon]]:text-green-600 dark:[&_[data-slot=linkLeadingIcon]]:text-green-400 dark:[&_[data-slot=childLinkIcon]]:text-green-400',
  purple:
    '[&_[data-slot=linkLeadingIcon]]:text-purple-600 [&_[data-slot=childLinkIcon]]:text-purple-600 dark:[&_[data-slot=linkLeadingIcon]]:text-purple-400 dark:[&_[data-slot=childLinkIcon]]:text-purple-400',
  orange:
    '[&_[data-slot=linkLeadingIcon]]:text-orange-600 [&_[data-slot=childLinkIcon]]:text-orange-600 dark:[&_[data-slot=linkLeadingIcon]]:text-orange-400 dark:[&_[data-slot=childLinkIcon]]:text-orange-400',
  yellow:
    '[&_[data-slot=linkLeadingIcon]]:text-yellow-600 [&_[data-slot=childLinkIcon]]:text-yellow-600 dark:[&_[data-slot=linkLeadingIcon]]:text-yellow-400 dark:[&_[data-slot=childLinkIcon]]:text-yellow-400',
  gray: '[&_[data-slot=linkLeadingIcon]]:text-gray-600 [&_[data-slot=childLinkIcon]]:text-gray-600 dark:[&_[data-slot=linkLeadingIcon]]:text-gray-400 dark:[&_[data-slot=childLinkIcon]]:text-gray-400',
  warning:
    '[&_[data-slot=linkLeadingIcon]]:text-amber-600 [&_[data-slot=childLinkIcon]]:text-amber-600 dark:[&_[data-slot=linkLeadingIcon]]:text-amber-400 dark:[&_[data-slot=childLinkIcon]]:text-amber-400',
  error:
    '[&_[data-slot=linkLeadingIcon]]:text-red-600 [&_[data-slot=childLinkIcon]]:text-red-600 dark:[&_[data-slot=linkLeadingIcon]]:text-red-400 dark:[&_[data-slot=childLinkIcon]]:text-red-400',
  teal: '[&_[data-slot=linkLeadingIcon]]:text-teal-600 [&_[data-slot=childLinkIcon]]:text-teal-600 dark:[&_[data-slot=linkLeadingIcon]]:text-teal-400 dark:[&_[data-slot=childLinkIcon]]:text-teal-400',
  amber:
    '[&_[data-slot=linkLeadingIcon]]:text-amber-600 [&_[data-slot=childLinkIcon]]:text-amber-600 dark:[&_[data-slot=linkLeadingIcon]]:text-amber-400 dark:[&_[data-slot=childLinkIcon]]:text-amber-400',
  cyan: '[&_[data-slot=linkLeadingIcon]]:text-cyan-600 [&_[data-slot=childLinkIcon]]:text-cyan-600 dark:[&_[data-slot=linkLeadingIcon]]:text-cyan-400 dark:[&_[data-slot=childLinkIcon]]:text-cyan-400',
  violet:
    '[&_[data-slot=linkLeadingIcon]]:text-violet-600 [&_[data-slot=childLinkIcon]]:text-violet-600 dark:[&_[data-slot=linkLeadingIcon]]:text-violet-400 dark:[&_[data-slot=childLinkIcon]]:text-violet-400',
  emerald:
    '[&_[data-slot=linkLeadingIcon]]:text-emerald-600 [&_[data-slot=childLinkIcon]]:text-emerald-600 dark:[&_[data-slot=linkLeadingIcon]]:text-emerald-400 dark:[&_[data-slot=childLinkIcon]]:text-emerald-400',
  rose: '[&_[data-slot=linkLeadingIcon]]:text-rose-600 [&_[data-slot=childLinkIcon]]:text-rose-600 dark:[&_[data-slot=linkLeadingIcon]]:text-rose-400 dark:[&_[data-slot=childLinkIcon]]:text-rose-400',
  sky: '[&_[data-slot=linkLeadingIcon]]:text-sky-600 [&_[data-slot=childLinkIcon]]:text-sky-600 dark:[&_[data-slot=linkLeadingIcon]]:text-sky-400 dark:[&_[data-slot=childLinkIcon]]:text-sky-400',
}
