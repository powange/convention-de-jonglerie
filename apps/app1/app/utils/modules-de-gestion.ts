import type { CouleurDeModule } from '~/utils/couleurs-de-module'

/**
 * Ce qui identifie visuellement chaque module de gestion : son icône et sa couleur.
 *
 * Elles vivaient uniquement dans les cartes de l'accueil de gestion, et chaque page de module les
 * redéclarait à la main dans son propre titre. Les deux surfaces avaient dérivé — mesuré le
 * 25/09/2026, sur 44 cartes :
 *
 * - **13 pages n'affichaient aucune icône** — `about`, `convention`, `general-info`, `map`,
 *   `treasury`, les trois écrans de repas, et d'autres ;
 * - **5 en affichaient une autre** que celle annoncée par leur carte — `artists` une étoile pour
 *   un groupe, `shows-call` des étincelles pour un mégaphone ;
 * - **8 avaient la bonne icône mais pas la bonne couleur** — `workshops` indigo sur l'accueil et
 *   verte sur sa page, `features` émeraude puis bleue, quatre retombées sur `primary`.
 *
 * Corriger les pages une à une aurait reproduit le défaut : la même information à deux endroits
 * finit toujours par diverger. D'où cette table unique, lue par les cartes de l'accueil ET par
 * l'en-tête de chaque page. Ajouter un module, c'est une ligne.
 *
 * La CLÉ est le chemin sous `/gestion/`, tel qu'il apparaît dans l'URL. Une page sans entrée ici
 * affichera son titre sans icône, ce qui reste correct — l'oubli est visible, jamais bloquant.
 */
export interface ModuleDeGestion {
  icone: string
  couleur: CouleurDeModule
}

export const MODULES_DE_GESTION: Record<string, ModuleDeGestion> = {
  about: { icone: 'i-lucide-file-text', couleur: 'indigo' },
  'ai-update': { icone: 'i-lucide-sparkles', couleur: 'yellow' },
  artists: { icone: 'i-heroicons-users', couleur: 'yellow' },
  'artists/notifications': { icone: 'i-heroicons-bell', couleur: 'yellow' },
  'artists/shows': { icone: 'i-heroicons-sparkles', couleur: 'purple' },
  convention: { icone: 'i-heroicons-building-library', couleur: 'blue' },
  'external-links': { icone: 'i-lucide-link', couleur: 'violet' },
  faq: { icone: 'i-heroicons-question-mark-circle', couleur: 'indigo' },
  features: { icone: 'i-lucide-toggle-right', couleur: 'emerald' },
  'general-info': { icone: 'i-lucide-settings', couleur: 'cyan' },
  'lost-found': { icone: 'i-heroicons-magnifying-glass', couleur: 'yellow' },
  map: { icone: 'i-lucide-map', couleur: 'blue' },
  meals: { icone: 'cbi:mealie', couleur: 'orange' },
  'meals/list': { icone: 'i-heroicons-list-bullet', couleur: 'purple' },
  'meals/validate': { icone: 'i-heroicons-check-badge', couleur: 'green' },
  organizers: { icone: 'i-heroicons-user-group', couleur: 'purple' },
  program: { icone: 'i-heroicons-calendar-days', couleur: 'amber' },
  services: { icone: 'i-lucide-wrench', couleur: 'teal' },
  'shows-call': { icone: 'i-heroicons-megaphone', couleur: 'amber' },
  stock: { icone: 'i-heroicons-archive-box', couleur: 'amber' },
  tasks: { icone: 'i-heroicons-clipboard-document-check', couleur: 'rose' },
  'ticketing/access-control': { icone: 'i-heroicons-shield-check', couleur: 'blue' },
  'ticketing/config': { icone: 'i-heroicons-cog-6-tooth', couleur: 'blue' },
  'ticketing/counter': { icone: 'i-heroicons-calculator', couleur: 'teal' },
  'ticketing/external': { icone: 'i-heroicons-link', couleur: 'purple' },
  'ticketing/handout-items': { icone: 'i-heroicons-gift', couleur: 'orange' },
  'ticketing/orders': { icone: 'i-heroicons-shopping-cart', couleur: 'green' },
  'ticketing/quotas': { icone: 'i-heroicons-chart-bar', couleur: 'orange' },
  'ticketing/stats': { icone: 'i-heroicons-chart-bar', couleur: 'indigo' },
  'ticketing/tiers': { icone: 'i-heroicons-currency-euro', couleur: 'orange' },
  treasury: { icone: 'i-heroicons-calculator', couleur: 'sky' },
  'volunteers/applications': { icone: 'i-heroicons-document-text', couleur: 'green' },
  'volunteers/config': { icone: 'i-heroicons-cog-6-tooth', couleur: 'gray' },
  'volunteers/form': { icone: 'i-heroicons-megaphone', couleur: 'blue' },
  'volunteers/notifications': { icone: 'i-heroicons-bell', couleur: 'yellow' },
  'volunteers/page': { icone: 'i-heroicons-clipboard-document-list', couleur: 'indigo' },
  'volunteers/planning': { icone: 'i-heroicons-calendar-days', couleur: 'orange' },
  'volunteers/renforts': { icone: 'i-heroicons-bolt', couleur: 'green' },
  'volunteers/swaps': { icone: 'i-lucide-arrow-left-right', couleur: 'blue' },
  'volunteers/team-distribution': { icone: 'i-heroicons-rectangle-group', couleur: 'purple' },
  'volunteers/teams': { icone: 'i-heroicons-user-group', couleur: 'purple' },
  workshops: { icone: 'i-heroicons-academic-cap', couleur: 'indigo' },
}

/**
 * Le module que décrit ce chemin, s'il est connu.
 *
 * Accepte une URL complète ou le seul segment : `/editions/22/gestion/stock` comme `stock`.
 * Les pages de détail — `stock/items/12` — retombent sur leur module parent, `stock`, en
 * retirant les segments numériques : c'est bien le même module, et la même couleur.
 */
export function moduleDeGestion(chemin: string): ModuleDeGestion | undefined {
  const apres = chemin.includes('/gestion/') ? chemin.split('/gestion/')[1] : chemin
  if (!apres) return undefined
  const segments = apres
    .split('?')[0]!
    .split('/')
    .filter((s) => s && !/^\d+$/.test(s))

  // Du plus précis au plus général : `ticketing/tiers` avant `ticketing`.
  for (let i = segments.length; i > 0; i--) {
    const cle = segments.slice(0, i).join('/')
    if (MODULES_DE_GESTION[cle]) return MODULES_DE_GESTION[cle]
  }
  return undefined
}
