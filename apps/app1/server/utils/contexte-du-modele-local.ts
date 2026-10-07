/**
 * Quel contexte le modèle local offre-t-il réellement ?
 *
 * La réponse décide de la quantité de page envoyée à l'IA : `calculateMaxContentSize` en tire un
 * plafond de caractères. Se tromper ici ne provoque aucune erreur — ça tronque, en silence.
 *
 * ## Trois défauts de la détection précédente
 *
 * Elle lisait `data.data[0].context_length` sur `/v1/models`, donc :
 *
 * 1. **un modèle au hasard** — `data[0]` est le premier de la liste des modèles INSTALLÉS, pas
 *    celui qu'on interroge. Avec plusieurs modèles téléchargés, la valeur venait d'un autre ;
 * 2. **`context_length` n'existe que modèle CHARGÉ**, et LM Studio charge à la demande : au moment
 *    de la détection, souvent rien n'est chargé ;
 * 3. **et le repli était 4096**, soit ~6 200 caractères de contenu — un huitième d'une page de
 *    convention, pour un modèle qui en accepte bien plus.
 *
 * ## Ce que cette fonction fait
 *
 * Elle lit `/api/v0/models`, l'API native, qui rend pour chaque modèle `loaded_context_length`
 * (quand il est chargé) ET `max_context_length` (toujours). Elle cherche le modèle PAR SON
 * IDENTIFIANT, et ne retombe sur un autre qu'à défaut.
 *
 * ⚠️ `max_context_length` EST UN PLAFOND THÉORIQUE, PAS UNE PROMESSE. C'est le maximum
 * d'entraînement — 262144 pour Gemma 4 — alors que l'instance sera chargée avec le contexte
 * configuré dans LM Studio, souvent bien plus petit : tenir 256K de cache KV ne rentre pas dans
 * 16 Go. S'en servir tel quel ferait envoyer dix fois trop. Il est donc **borné**, et ne sert que
 * faute de valeur chargée.
 */

/** Ce que `/api/v0/models` rend par modèle, réduit à ce qui nous intéresse. */
export interface ModeleLocal {
  id?: string
  state?: string
  loaded_context_length?: number
  max_context_length?: number
  /** Rendu par `/v1/models` quand le modèle est chargé. */
  context_length?: number
}

/**
 * Le plafond appliqué à `max_context_length`.
 *
 * Choisi au-dessus de ce dont l'extraction a besoin — le contenu est de toute façon borné à 50 000
 * caractères, soit ~12 500 jetons — et assez bas pour qu'une instance chargée modestement ne soit
 * pas débordée. Mieux vaut tronquer un peu que voir le serveur refuser la requête entière.
 */
export const PLAFOND_CONTEXTE_THEORIQUE = 32768

export interface ContexteDetecte {
  jetons: number
  /** D'où vient la valeur, pour que le journal le dise. */
  source: 'charge' | 'theorique_borne' | 'defaut'
  /** L'identifiant du modèle dont la valeur a été lue, quand on l'a. */
  modele?: string
}

/**
 * Le modèle à interroger parmi ceux que le serveur annonce.
 *
 * Par identifiant d'abord — c'est celui qu'on utilise. À défaut, un modèle CHARGÉ, dont la valeur
 * est au moins réelle. En dernier recours le premier, qui vaut mieux que rien.
 */
export function modeleAInterroger(
  modeles: readonly ModeleLocal[],
  identifiant?: string | null
): ModeleLocal | undefined {
  if (identifiant) {
    const exact = modeles.find((m) => m.id === identifiant)
    if (exact) return exact
  }
  return modeles.find((m) => m.state === 'loaded') ?? modeles[0]
}

/** Le contexte à retenir, d'après ce que le serveur a répondu. */
export function contexteDuModele(
  modeles: readonly ModeleLocal[] | null | undefined,
  identifiant: string | null | undefined,
  parDefaut: number
): ContexteDetecte {
  const modele = modeles?.length ? modeleAInterroger(modeles, identifiant) : undefined
  if (!modele) return { jetons: parDefaut, source: 'defaut' }

  // La valeur CHARGÉE est la seule qui dise ce que le serveur acceptera réellement.
  const charge = modele.loaded_context_length || modele.context_length
  if (charge && charge > 0) {
    return { jetons: charge, source: 'charge', modele: modele.id }
  }

  // Rien de chargé : le plafond théorique, borné. Voir l'avertissement en tête de fichier.
  if (modele.max_context_length && modele.max_context_length > 0) {
    return {
      jetons: Math.min(modele.max_context_length, PLAFOND_CONTEXTE_THEORIQUE),
      source: 'theorique_borne',
      modele: modele.id,
    }
  }

  return { jetons: parDefaut, source: 'defaut', modele: modele.id }
}
