/**
 * Les briques de lecture et d'écriture des filtres dans l'URL.
 *
 * Chaque écran décide de SES filtres — leurs clés, leurs défauts, ce qui compte comme « pas de
 * filtre ». Mais tous répondent aux mêmes questions de bas niveau : comment lire une liste que
 * l'URL porte, que faire d'une valeur que personne ne reconnaît, comment réécrire la query sans
 * effacer ce qu'un autre réglage y avait mis. Ces réponses-là vivent ici, en un seul endroit
 * éprouvé, plutôt que recopiées dans chaque utilitaire d'écran — où elles ont déjà commencé à
 * diverger.
 *
 * Deux règles tiennent l'ensemble :
 *
 * - **Seul ce qui s'écarte du défaut figure dans l'URL.** Une URL courte reste lisible et
 *   copiable ; une URL qui énumère l'état d'arrivée de chaque filtre ne l'est plus.
 * - **Ce qu'on ne gère pas, on le préserve.** Un filtre d'équipe n'a aucune raison d'effacer
 *   l'onglet actif ou la page voisine, qu'un autre bout de l'écran a posés là.
 */

/** Une valeur textuelle portée par l'URL, ou la chaîne vide si l'URL n'en dit rien. */
export function texteDepuisUrl(brut: unknown): string {
  return typeof brut === 'string' ? brut : ''
}

/** Une liste portée par l'URL, séparée par des virgules. */
export function listeDepuisUrl(brut: unknown): string[] {
  if (typeof brut !== 'string' || !brut) return []
  return brut.split(',').filter(Boolean)
}

/**
 * Une liste d'entiers portée par l'URL.
 *
 * Les fragments qui ne sont pas des entiers sont écartés plutôt que rendus en `NaN` : un
 * identifiant tronqué dans une URL recopiée à la main ne doit pas empoisonner une requête.
 */
export function entiersDepuisUrl(brut: unknown): number[] {
  return listeDepuisUrl(brut)
    .map((fragment) => Number(fragment))
    .filter((valeur) => Number.isInteger(valeur))
}

/** Un entier strictement positif porté par l'URL, ou le défaut pour tout le reste. */
export function entierDepuisUrl(brut: unknown, defaut: number): number {
  if (typeof brut !== 'string' || !brut) return defaut
  const valeur = Number(brut)
  return Number.isInteger(valeur) && valeur > 0 ? valeur : defaut
}

/**
 * Une valeur choisie dans une liste fermée, ou le défaut.
 *
 * C'est la garde qui évite l'écran vide sans cause visible : une URL vieillie, tronquée ou
 * bricolée à la main porte une valeur que plus personne ne reconnaît, et la retenir telle quelle
 * filtrerait sur rien — sans que l'interface puisse même l'afficher.
 */
export function valeurDepuisUrl<T extends string>(
  brut: unknown,
  admises: readonly T[],
  defaut: T
): T {
  return typeof brut === 'string' && (admises as readonly string[]).includes(brut)
    ? (brut as T)
    : defaut
}

/**
 * Ce que l'URL porte pour une sélection vidée de tout.
 *
 * Une sélection multiple dont le défaut est « tout coché » a trois états, pas deux : le défaut,
 * un sous-ensemble, et le vide. Sans ce marqueur, le vide s'écrirait comme une clé absente —
 * c'est-à-dire comme le défaut —, et décocher toutes les cases serait le seul réglage que l'URL
 * ne saurait pas retenir.
 */
export const AUCUNE_SELECTION = 'aucune'

/** Deux sélections portant les mêmes éléments, quel que soit leur ordre. */
function memeEnsemble(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const elements = new Set(b)
  return a.every((element) => elements.has(element))
}

/** Une sélection multiple portée par l'URL, ou le défaut si l'URL n'en dit rien. */
export function selectionDepuisUrl(brut: unknown, defaut: readonly string[]): string[] {
  if (brut === AUCUNE_SELECTION) return []
  const lue = listeDepuisUrl(brut)
  return lue.length > 0 ? lue : [...defaut]
}

/** La sélection telle que l'URL la porte. Rend la chaîne vide quand elle est au défaut. */
export function selectionVersUrl(selection: readonly string[], defaut: readonly string[]): string {
  if (memeEnsemble(selection, defaut)) return ''
  return selection.length > 0 ? selection.join(',') : AUCUNE_SELECTION
}

/** Une colonne de tri, sous la forme que les tableaux TanStack manipulent. */
export interface ColonneTriee {
  id: string
  desc: boolean
}

/**
 * Le tri porté par l'URL : `nom` pour croissant, `-nom` pour décroissant.
 *
 * Le signe plutôt qu'un second paramètre `order` : un tri tient alors en une clé, et l'URL reste
 * lisible d'un coup d'œil.
 */
export function triDepuisUrl(brut: unknown): ColonneTriee[] {
  return listeDepuisUrl(brut).map((fragment) =>
    fragment.startsWith('-') ? { id: fragment.slice(1), desc: true } : { id: fragment, desc: false }
  )
}

/** Le tri, tel que l'URL le porte. Rend la chaîne vide pour un tri absent. */
export function triVersUrl(tri: readonly ColonneTriee[]): string {
  return tri.map((colonne) => `${colonne.desc ? '-' : ''}${colonne.id}`).join(',')
}

/**
 * La query reflétant les valeurs gérées, les paramètres étrangers préservés.
 *
 * Les clés de `valeurs` sont exactement celles que l'écran gère : une valeur vide les retire de
 * l'URL, ce qui est la façon d'y dire « ce filtre est à son défaut ». Tout le reste de la query
 * est recopié tel quel.
 *
 * On reconstruit plutôt qu'on ne supprime clé à clé : un `delete` sur une clé calculée est refusé
 * par le linter, et l'omission dit la même chose sans détour.
 */
export function requeteAvec(
  queryActuelle: Record<string, unknown>,
  valeurs: Record<string, string>
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}

  for (const [cle, valeur] of Object.entries(queryActuelle)) {
    if (cle in valeurs) continue
    if (typeof valeur === 'string') query[cle] = valeur
    // Une clé répétée arrive en tableau. La recopier plutôt que la laisser tomber : c'est un
    // paramètre étranger comme un autre, et rien ne dit qu'il n'est pas lu ailleurs.
    else if (Array.isArray(valeur)) {
      query[cle] = valeur.filter((element): element is string => typeof element === 'string')
    }
  }

  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (valeur) query[cle] = valeur
  }

  return query
}
