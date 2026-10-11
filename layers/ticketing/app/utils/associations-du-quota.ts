/**
 * Ce qu'une suppression de quota emporte avec elle — constat F3.
 *
 * ## Le défaut
 *
 * Six tables de liaison portent `onDelete: Cascade` vers `TicketingQuota` : tarifs, options,
 * champs personnalisés, organisateurs, équipes de bénévoles, spectacles. Supprimer un quota posé
 * sur douze cibles les effaçait **toutes**, et la confirmation ne nommait que le quota —
 * **six cascades, zéro mot**, pour une action **irréversible**.
 *
 * ## Pourquoi une fonction pure
 *
 * C'est elle qui décide ce que la personne lit avant de cliquer « Supprimer ». Les deux défauts
 * possibles sont invisibles à la relecture : annoncer une famille à **zéro** (« 0 tarif »,
 * du bruit qui fait douter du reste) ou **oublier** une famille peuplée (on efface ce qu'on
 * n'avait pas vu). Un test les couvre tous les deux.
 *
 * Aucun libellé ici : la fonction rend des **clés** et des nombres, et l'appelant traduit. Un mot
 * français en dur sortirait tel quel chez un lecteur allemand.
 */

/** Les comptes rendus par le point d'API, un par relation du modèle. */
export interface ComptesDuQuota {
  tiers?: number
  options?: number
  customFields?: number
  organizers?: number
  volunteers?: number
  artists?: number
}

/**
 * Les six familles, dans l'ordre où elles se lisent.
 *
 * ⚠️ L'ordre n'est pas l'alphabet : il va du plus structurant (le tarif, qui décide qui peut
 * acheter) au plus particulier (un spectacle). Quelqu'un qui s'arrête à la première ligne a lu
 * la plus lourde.
 */
export const FAMILLES_DU_QUOTA = [
  { champ: 'tiers', cle: 'delete_links_tiers' },
  { champ: 'options', cle: 'delete_links_options' },
  { champ: 'customFields', cle: 'delete_links_custom_fields' },
  { champ: 'organizers', cle: 'delete_links_organizers' },
  { champ: 'volunteers', cle: 'delete_links_volunteers' },
  { champ: 'artists', cle: 'delete_links_artists' },
] as const satisfies ReadonlyArray<{ champ: keyof ComptesDuQuota; cle: string }>

export interface AssociationsDuQuota {
  /** Toutes familles confondues. Zéro quand le quota n'est posé sur rien. */
  total: number
  /** Seules les familles PEUPLÉES, dans l'ordre de lecture. */
  familles: Array<{ cle: string; nombre: number }>
}

export function associationsDuQuota(
  comptes: ComptesDuQuota | null | undefined
): AssociationsDuQuota {
  const familles: AssociationsDuQuota['familles'] = []
  let total = 0

  for (const { champ, cle } of FAMILLES_DU_QUOTA) {
    const nombre = comptes?.[champ] ?? 0
    total += nombre
    // ⚠️ Une famille à zéro n'est PAS annoncée : « 0 tarif » est du bruit, et du bruit dans une
    // confirmation de suppression fait douter du reste du message.
    if (nombre > 0) familles.push({ cle, nombre })
  }

  return { total, familles }
}
