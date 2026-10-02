import { defineAsyncComponent } from 'vue'

import type { AsyncComponentLoader, Component } from 'vue'

/**
 * Charger un composant à la demande, en survivant à une bribe qui n'arrive pas.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Le 2 octobre 2026, la production a affiché une page d'erreur
 * complète — « 500 Internal Server Error / Failed to fetch dynamically imported module » — sur un
 * simple passage à l'accueil. Vérifié sur la prod le même matin : la bribe nommée existait bien
 * (HTTP 200, octets identiques au cache et à l'origine, 56 dépendances toutes servies), et le
 * journal d'erreurs du serveur ne contenait rien. **La requête avait échoué une fois, chez le
 * visiteur.** Rien n'était cassé ; c'est la RÉACTION à cet aléa qui était fausse.
 *
 * Deux défauts se cumulaient :
 *
 * 1. `defineAsyncComponent(() => import(…))` **n'essaie qu'une fois**. Une coupure de réseau d'une
 *    seconde — un métro, un wifi qui bascule, un nœud de CDN qui bronche — est définitive.
 * 2. Ce rejet remonte par `<Suspense>` jusqu'à la frontière d'erreur de Nuxt, donc **toute la page
 *    disparaît** pour un composant secondaire. L'accueil chargeait ainsi sa carte et son agenda :
 *    la carte ne s'affiche pas, et c'est la liste des conventions qu'on perd.
 *
 * 📍 CE QUI NE SUFFIT PAS. `emitRouteChunkError: 'automatic-immediate'` (cf. nuxt.config.ts) est
 * bien en place et recharge l'application sur `app:chunkError`. Mais il a une garde anti-boucle
 * (`nuxt:reload` en sessionStorage, 10 s par chemin) : au deuxième échec rapproché, plus de
 * rechargement, et la page d'erreur réapparaît. Reprendre le chargement de la seule bribe fautive
 * est de toute façon moins brutal qu'un rechargement complet de l'application.
 */

/** Chargements tentés en tout : le premier, plus deux reprises. */
export const TENTATIVES_DE_CHARGEMENT = 3

/** Court, mais non nul : une coupure franche ne se résorbe pas dans la même milliseconde. */
const ATTENTE_AVANT_REPRISE_MS = 300

/**
 * Est-ce l'échec d'une bribe, et non une erreur du composant lui-même ?
 *
 * ⚠️ La distinction décide du comportement : une bribe qui n'arrive pas mérite une reprise, une
 * exception dans le `setup` du composant n'en mériterait aucune — on la rejouerait à l'identique
 * deux fois de plus, en retardant d'autant l'affichage de l'erreur.
 *
 * Les libellés varient d'un navigateur à l'autre pour la MÊME cause : « Failed to fetch
 * dynamically imported module » (Chrome), « error loading dynamically imported module » (Firefox),
 * « Importing a module script failed » (Safari). D'où le motif, et non une égalité de chaîne.
 */
export function echecDeBribe(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? '')
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message
  )
}

/** Faut-il reprendre ? `tentative` vaut 1 au premier échec, comme le veut Vue. */
export function reprendreLeChargement(erreur: unknown, tentative: number): boolean {
  return echecDeBribe(erreur) && tentative < TENTATIVES_DE_CHARGEMENT
}

/**
 * Remplace `defineAsyncComponent(() => import('…'))` partout où l'échec du chargement ne doit pas
 * emporter la page.
 *
 * Ce que ce util ne fait PAS : contenir l'erreur. Après la dernière tentative, le rejet remonte
 * comme avant — c'est à l'appelant de l'entourer d'un `<NuxtErrorBoundary>` avec
 * `<UiEchecDeChargement>` en secours. Les deux moitiés sont nécessaires : sans reprise, la
 * frontière afficherait un encart pour un aléa de 300 ms ; sans frontière, la reprise épuisée
 * reprendrait la page entière.
 */
/**
 * La politique de reprise, exportée à part pour être éprouvée sans monter de composant.
 *
 * ⚠️ Un test qui monterait un composant dont la bribe n'arrive JAMAIS laisse derrière lui un rejet
 * non traité : Vue conserve la promesse échouée dans son `pendingRequest` sans que personne ne s'y
 * accroche. La branche « abandon » se vérifie donc ici, par les deux rappels.
 */
export function surEchecDeChargement(
  erreur: unknown,
  reessayer: () => void,
  abandonner: () => void,
  tentative: number
): void {
  if (!reprendreLeChargement(erreur, tentative)) {
    abandonner()
    return
  }
  setTimeout(reessayer, ATTENTE_AVANT_REPRISE_MS * tentative)
}

export function composantDiffere<T extends Component>(chargeur: AsyncComponentLoader<T>) {
  return defineAsyncComponent({
    loader: chargeur,
    onError: surEchecDeChargement,
  })
}
