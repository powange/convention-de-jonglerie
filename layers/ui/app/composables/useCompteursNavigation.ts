import { computed, reactive, type ComputedRef } from 'vue'

/**
 * Le registre des compteurs affichés dans une navigation.
 *
 * Le problème qu'il résout : une pastille n'est utile que si elle se voit **sans** ouvrir la page
 * qu'elle signale. C'est donc la navigation qui doit connaître le compte — alors qu'elle n'a
 * aucune raison de savoir comment on compte des emprunts en retard, des candidatures en attente ou
 * quoi que ce soit d'autre.
 *
 * D'où l'inversion : chaque module déclare *comment* obtenir son compte, la navigation demande
 * seulement *le* compte. Le menu ne dépend d'aucun module, et un module s'ajoute sans qu'on
 * rouvre le menu.
 *
 * L'état est au niveau du module et non dans le composable : un compteur publié depuis un plugin
 * doit être lisible par une barre de navigation montée ailleurs, et deux instances séparées ne se
 * verraient pas.
 */

/** Ce que la navigation transmet aux fournisseurs. Son contenu ne regarde qu'eux. */
export type ContexteCompteur = Record<string, unknown>

export interface FournisseurCompteur {
  /** Identifie l'entrée de menu. Deux fournisseurs de même clé : le dernier gagne. */
  cle: string
  /**
   * Rend le compte, ou `null` quand il n'y a rien à afficher — module désactivé, droits
   * insuffisants, contexte hors sujet. `null` efface la pastille au lieu de la figer.
   */
  charger: (contexte: ContexteCompteur) => Promise<number | null>
}

const fournisseurs = new Map<string, FournisseurCompteur>()

// Une `Map` réactive et non un objet : les clés vont et viennent au fil des modules, et retirer
// une clé d'un objet réactif demande un `delete` que le projet interdit — à raison, il se prête
// mal au suivi des dépendances.
const comptes = reactive(new Map<string, number | null>())

/**
 * Ce que le dernier rafraîchissement complet savait : dans quel contexte on se trouve, et quelles
 * entrées l'utilisateur voit.
 *
 * Retenu ici parce qu'un écran qui vient de modifier des données n'a aucun moyen de le savoir.
 * Il connaît son édition, mais pas la liste des entrées visibles — laquelle dépend de droits que
 * la barre de navigation a résolus pour lui. Sans cette mémoire, un rafraîchissement ciblé devrait
 * réinventer ce calcul, et se tromperait.
 */
let dernierContexte: ContexteCompteur | null = null
let dernieresClesActives: ReadonlySet<string> | null = null

/**
 * Déclare comment obtenir un compte. À appeler depuis un plugin du layer concerné.
 *
 * Rend une fonction qui retire le fournisseur — utile aux tests, et à un module qu'on démonte.
 */
export function enregistrerFournisseurCompteur(fournisseur: FournisseurCompteur): () => void {
  fournisseurs.set(fournisseur.cle, fournisseur)
  return () => {
    fournisseurs.delete(fournisseur.cle)
    comptes.delete(fournisseur.cle)
  }
}

/**
 * Recharge les compteurs pour ce contexte.
 *
 * `clesActives` dit quelles entrées l'utilisateur voit réellement. Les autres ne sont pas
 * interrogées, et leur compteur est effacé — un module absent du menu ne doit pas laisser sa
 * pastille de la visite précédente.
 *
 * Ce n'est pas qu'une économie de requêtes : un compteur interrogé pour un module auquel
 * l'utilisateur n'a pas droit provoque un refus côté serveur. Une barre de navigation ne devrait
 * jamais produire d'erreur pour quelqu'un qui n'a rien demandé — et le journal d'erreurs se
 * remplirait de 403 parfaitement légitimes.
 *
 * Sans `clesActives`, tous les fournisseurs sont interrogés : c'est le comportement d'une
 * navigation qui ne filtre rien.
 *
 * Les fournisseurs sont interrogés en parallèle et **isolés** les uns des autres : celui qui
 * échoue efface son propre compteur et laisse les autres tranquilles. Une barre de navigation qui
 * disparaîtrait parce qu'un module a mal répondu serait une régression bien pire que la pastille
 * manquante.
 */
export async function rafraichirCompteursNavigation(
  contexte: ContexteCompteur,
  clesActives?: readonly string[]
): Promise<void> {
  const actives = clesActives ? new Set(clesActives) : null

  dernierContexte = contexte
  dernieresClesActives = actives

  for (const cle of [...comptes.keys()]) {
    if (actives && !actives.has(cle)) comptes.delete(cle)
  }

  const aInterroger = [...fournisseurs.values()].filter(
    (fournisseur) => !actives || actives.has(fournisseur.cle)
  )

  await Promise.all(
    aInterroger.map(async (fournisseur) => {
      try {
        const compte = await fournisseur.charger(contexte)
        comptes.set(fournisseur.cle, typeof compte === 'number' ? compte : null)
      } catch {
        // Silencieux à dessein : l'échec d'un compteur ne doit pas remonter à l'écran. Ce qu'il
        // signale est visible sur la page du module, qui, elle, rapporte ses erreurs.
        comptes.set(fournisseur.cle, null)
      }
    })
  )
}

/** Efface tous les comptes, en gardant les fournisseurs — au changement de contexte. */
export function oublierCompteursNavigation(): void {
  comptes.clear()
  // Le contexte retenu part avec les comptes : il désignait l'édition qu'on vient de quitter, et
  // un rafraîchissement ciblé qui s'en servirait recompterait sur la mauvaise.
  dernierContexte = null
  dernieresClesActives = null
}

/**
 * Recharge quelques compteurs, et rien d'autre.
 *
 * À appeler depuis un écran qui vient de modifier ce qu'un compteur compte — accepter une
 * candidature, rendre un objet. Le menu ne recalcule qu'au montage : sans cela, la pastille reste
 * sur sa valeur d'arrivée jusqu'au prochain chargement de page.
 *
 * La différence avec `rafraichirCompteursNavigation` n'est pas seulement le nombre de clés : cette
 * dernière prend la liste de **tout** ce qui est visible et **efface** le reste. S'en servir pour
 * viser un compteur effaçait donc tous les autres — sans conséquence tant qu'il n'y en avait qu'un,
 * visible dès qu'il y en a eu trois.
 *
 * Une clé inconnue, ou qui n'est pas dans les entrées visibles, est ignorée en silence : l'écran
 * qui appelle n'a pas à savoir ce que la navigation affiche, et interroger un module auquel
 * l'utilisateur n'a pas droit lui vaudrait un refus du serveur.
 *
 * Sans rafraîchissement complet préalable, il n'y a rien à mettre à jour — ni contexte, ni
 * pastille affichée : l'appel ne fait rien plutôt que de deviner.
 */
export async function rafraichirCompteurs(...cles: readonly string[]): Promise<void> {
  if (!dernierContexte) return

  const contexte = dernierContexte
  const aInterroger = cles
    .map((cle) => fournisseurs.get(cle))
    .filter((fournisseur): fournisseur is FournisseurCompteur => {
      if (!fournisseur) return false
      return !dernieresClesActives || dernieresClesActives.has(fournisseur.cle)
    })

  await Promise.all(
    aInterroger.map(async (fournisseur) => {
      try {
        const compte = await fournisseur.charger(contexte)
        comptes.set(fournisseur.cle, typeof compte === 'number' ? compte : null)
      } catch {
        // Isolé comme dans le rafraîchissement complet : l'échec d'un compteur ne remonte pas à
        // l'écran, et n'empêche pas les autres d'aboutir.
        comptes.set(fournisseur.cle, null)
      }
    })
  )
}

/** Le compte d'une entrée, réactif. `null` tant qu'il n'a pas été chargé. */
export function compteurNavigation(cle: string): ComputedRef<number | null> {
  return computed(() => comptes.get(cle) ?? null)
}

/** Une copie des comptes, pour inspection et pour les tests. */
export function comptesNavigation(): Record<string, number | null> {
  return Object.fromEntries(comptes)
}
