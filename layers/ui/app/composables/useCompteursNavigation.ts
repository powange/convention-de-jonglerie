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
 * Recharge tous les compteurs pour ce contexte.
 *
 * Les fournisseurs sont interrogés en parallèle et **isolés** les uns des autres : celui qui
 * échoue efface son propre compteur et laisse les autres tranquilles. Une barre de navigation qui
 * disparaîtrait parce qu'un module a mal répondu serait une régression bien pire que la pastille
 * manquante.
 */
export async function rafraichirCompteursNavigation(contexte: ContexteCompteur): Promise<void> {
  await Promise.all(
    [...fournisseurs.values()].map(async (fournisseur) => {
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
}

/** Le compte d'une entrée, réactif. `null` tant qu'il n'a pas été chargé. */
export function compteurNavigation(cle: string): ComputedRef<number | null> {
  return computed(() => comptes.get(cle) ?? null)
}

/** Une copie des comptes, pour inspection et pour les tests. */
export function comptesNavigation(): Record<string, number | null> {
  return Object.fromEntries(comptes)
}
