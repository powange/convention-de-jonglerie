/**
 * Qui a le droit de lire la configuration bénévole d'une édition, et jusqu'où.
 *
 * L'endpoint qui la rend n'avait aucun contrôle : la description, le mode, les quatorze réglages du
 * formulaire, les dates de montage — et surtout le nombre de candidatures reçues, acceptées et
 * refusées — répondaient à n'importe quel compte connecté, y compris sur une édition dont la page
 * de bénévolat n'est pas publique. La page, elle, était bien gardée : la porte était sur l'écran,
 * pas sur la donnée.
 *
 * Les compteurs sont le vrai sujet. Une convention qui prépare son recrutement sans l'avoir annoncé
 * laissait lire combien de personnes avaient déjà postulé et combien avaient été écartées.
 *
 * La règle vit ici, seule et testable, parce que c'est une règle d'accès : la dupliquer entre
 * l'écran et le serveur est précisément ce qui a produit le défaut voisin sur les équipes cachées.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La situation de celui qui demande, réduite à ce dont la règle a besoin. */
export interface ContexteDeLecture {
  /** La page de bénévolat de l'édition est-elle ouverte à tous ? */
  pagePublic: boolean
  /** A-t-il le droit de gérer les bénévoles de cette édition — éditeur, auteur ou organisateur ? */
  estGestionnaire: boolean
  /**
   * A-t-il déposé une candidature sur cette édition, quel qu'en soit le statut ?
   *
   * Y compris en attente et refusée, et c'est délibéré : l'écran « mes candidatures » a besoin de
   * savoir quelles questions ont été posées pour afficher les réponses que la personne a elle-même
   * données. Lui refuser les réglages lui rendrait sa propre candidature illisible.
   */
  aUneCandidature: boolean
}

/** Ce que la réponse a le droit de contenir. */
export interface DroitsDeLecture {
  /** Les réglages d'affichage et les questions du formulaire. */
  reglages: boolean
  /** Le décompte des candidatures par statut. */
  compteurs: boolean
}

/**
 * Ce que cette personne a le droit de lire.
 *
 * Deux niveaux, parce que deux besoins&nbsp;: savoir comment le formulaire est configuré est une
 * chose, savoir combien de gens y ont répondu en est une autre. Le premier sert à candidater et à
 * relire sa candidature ; le second ne sert qu'à gérer.
 */
export function droitsSurLaConfiguration(contexte: ContexteDeLecture): DroitsDeLecture {
  return {
    reglages: contexte.pagePublic || contexte.estGestionnaire || contexte.aUneCandidature,
    // Jamais au seul motif que la page est publique : rendre la page visible n'est pas publier ses
    // statistiques de recrutement.
    compteurs: contexte.estGestionnaire,
  }
}

/**
 * Ce que renvoie l'endpoint quand rien n'est lisible.
 *
 * 404 et non 403, comme le fait déjà la FAQ : sur une édition dont la page de bénévolat n'est pas
 * publique, un 403 confirmerait qu'il y a quelque chose à voir. Le module est alors invisible, pas
 * interdit.
 */
export const STATUT_CONFIGURATION_INVISIBLE = 404
