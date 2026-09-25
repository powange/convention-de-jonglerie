/**
 * Les catégories de l'accueil de gestion : leur icône et sa couleur.
 *
 * Elles vivaient écrites à la main dans le gabarit de l'accueil, une `icon-class` par section. La
 * barre latérale, qui regroupe les mêmes catégories, n'en savait rien : ses entrées parentes
 * restaient grises. Ce registre est désormais la seule source des deux côtés — la même raison qui a
 * fait naître celui des modules, et le même effet : la contradiction devient impossible à écrire.
 *
 * ⚠️ **L'accueil est la référence, pas l'inverse.** Les valeurs ci-dessous reprennent exactement
 * celles qu'il affichait : rien n'y change. Ce qui inclut deux irrégularités relevées au passage et
 * volontairement conservées — `stock` et `tresorerie` sont en `600` là où les autres sont en `500`,
 * et `benevoles` prend la couleur primaire du thème plutôt qu'une teinte nommée. Les aligner serait
 * un autre travail, avec sa propre décision.
 *
 * ⚠️ Pas de variante sombre, et c'est délibéré : l'accueil n'en a pas. Le menu doit lui être
 * identique, or ajouter un `dark:` d'un seul côté les ferait justement diverger.
 */
export interface CategorieDeGestion {
  icone: string
  /** Pour une icône posée directement, comme sur l'accueil. */
  classeIcone: string
  /**
   * Pour une icône atteinte depuis son lien, comme dans la barre latérale.
   *
   * On vise `data-slot` et non une position : une entrée à compteur voit son icône enveloppée dans
   * une pastille, et le premier enfant du lien devient cette enveloppe. Écrit en toutes lettres,
   * Tailwind ne générant que ce qu'il lit dans les sources.
   */
  classeDansUnLien: string
}

export const CATEGORIES_DE_GESTION: Record<string, CategorieDeGestion> = {
  convention: {
    icone: 'i-heroicons-building-library',
    classeIcone: 'text-blue-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-blue-500 [&_[data-slot=childLinkIcon]]:text-blue-500',
  },
  infos: {
    icone: 'i-lucide-info',
    classeIcone: 'text-blue-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-blue-500 [&_[data-slot=childLinkIcon]]:text-blue-500',
  },
  organisateurs: {
    icone: 'i-heroicons-user-group',
    classeIcone: 'text-purple-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-purple-500 [&_[data-slot=childLinkIcon]]:text-purple-500',
  },
  benevoles: {
    icone: 'i-heroicons-user-group',
    classeIcone: 'text-primary-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-primary-500 [&_[data-slot=childLinkIcon]]:text-primary-500',
  },
  artistes: {
    icone: 'i-heroicons-star',
    classeIcone: 'text-yellow-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-yellow-500 [&_[data-slot=childLinkIcon]]:text-yellow-500',
  },
  repas: {
    icone: 'cbi:mealie',
    classeIcone: 'text-orange-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-orange-500 [&_[data-slot=childLinkIcon]]:text-orange-500',
  },
  billetterie: {
    icone: 'i-heroicons-ticket',
    classeIcone: 'text-blue-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-blue-500 [&_[data-slot=childLinkIcon]]:text-blue-500',
  },
  ateliers: {
    icone: 'i-heroicons-academic-cap',
    classeIcone: 'text-indigo-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-indigo-500 [&_[data-slot=childLinkIcon]]:text-indigo-500',
  },
  taches: {
    icone: 'i-heroicons-clipboard-document-check',
    classeIcone: 'text-rose-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-rose-500 [&_[data-slot=childLinkIcon]]:text-rose-500',
  },
  stock: {
    icone: 'i-heroicons-archive-box',
    classeIcone: 'text-amber-600',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-amber-600 [&_[data-slot=childLinkIcon]]:text-amber-600',
  },
  faq: {
    icone: 'i-heroicons-question-mark-circle',
    classeIcone: 'text-indigo-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-indigo-500 [&_[data-slot=childLinkIcon]]:text-indigo-500',
  },
  tresorerie: {
    icone: 'i-heroicons-calculator',
    classeIcone: 'text-sky-600',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-sky-600 [&_[data-slot=childLinkIcon]]:text-sky-600',
  },
  'objets-trouves': {
    icone: 'i-heroicons-magnifying-glass',
    classeIcone: 'text-amber-500',
    classeDansUnLien:
      '[&_[data-slot=linkLeadingIcon]]:text-amber-500 [&_[data-slot=childLinkIcon]]:text-amber-500',
  },
}

/** La catégorie d'un identifiant, ou `undefined` — l'oubli se voit à l'œil, il ne casse rien. */
export function categorieDeGestion(id: string | undefined): CategorieDeGestion | undefined {
  return id ? CATEGORIES_DE_GESTION[id] : undefined
}
