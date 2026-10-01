/**
 * Les équipes qu'un planning doit montrer : celles que l'API rend, COMPLÉTÉES par celles que
 * portent ses propres créneaux.
 *
 * ⚠️ LE DÉFAUT CORRIGÉ. `/volunteer-teams` écarte les équipes marquées « non visibles lors de la
 * candidature » pour qui n'est ni gestionnaire ni bénévole accepté. C'est voulu, et c'est ce qui
 * empêche de lire « Sécurité nuit » ou « Gestion des conflits » depuis le formulaire de
 * candidature — voir `visibilite-equipes.ts`, côté serveur.
 *
 * Mais le planning se servait de cette même liste pour construire ses colonnes. Une équipe masquée
 * au formulaire y perdait donc la sienne, et ses créneaux disparaissaient du planning public alors
 * qu'ils y ont toute leur place : le réglage dit « visible lors de la CANDIDATURE », il ne dit rien
 * du planning.
 *
 * 📍 CE QUE LE RÉGLAGE NE PERD PAS AU PASSAGE, et c'est la raison de cette forme : on ne reconstitue
 * que les équipes qui ont au moins un créneau dans le planning qu'on vient de recevoir. Une équipe
 * masquée et sans créneau reste introuvable, exactement comme avant. C'est le serveur qui décide de
 * ce qu'il met dans ces créneaux ; cette fonction ne fait que refléter ce qu'il a déjà rendu — elle
 * n'ouvre aucun accès par elle-même.
 */

/** Ce qu'il faut d'une équipe pour la reconnaître. Le reste est recopié tel quel. */
export interface EquipeIdentifiable {
  id: string
}

/** Un créneau, réduit à l'équipe qu'il porte. */
export interface CreneauAvecEquipe {
  team?: EquipeIdentifiable | null
}

/**
 * @param equipes  la liste rendue par l'API, éventuellement amputée des équipes masquées
 * @param creneaux les créneaux du planning, chacun portant son équipe
 * @returns les équipes de `equipes`, dans leur ordre, suivies de celles que seuls les créneaux
 *          connaissaient — chacune une seule fois
 */
export function completerEquipesDepuisCreneaux<T extends EquipeIdentifiable>(
  equipes: readonly T[] | null | undefined,
  creneaux: readonly CreneauAvecEquipe[] | null | undefined
): T[] {
  const parIdentifiant = new Map<string, T>()

  // Les équipes de l'API d'abord : ce sont elles qui portent tous les champs, là où un créneau
  // n'en expose qu'une poignée. La première vue gagne, donc une équipe connue n'est jamais
  // remplacée par sa version réduite.
  for (const equipe of equipes ?? []) {
    if (equipe?.id) parIdentifiant.set(equipe.id, equipe)
  }

  for (const creneau of creneaux ?? []) {
    const equipe = creneau?.team
    if (equipe?.id && !parIdentifiant.has(equipe.id)) {
      parIdentifiant.set(equipe.id, equipe as unknown as T)
    }
  }

  return [...parIdentifiant.values()]
}
