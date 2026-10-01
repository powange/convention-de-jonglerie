import { z } from 'zod'

import { normaliserPhases, PHASES_EDITION, type PhaseEdition } from '~~/shared/utils/phases-edition'

/**
 * Une entrée d'association « article à remettre », telle que l'envoient les modales de
 * billetterie : l'article, et le nombre d'exemplaires remis.
 *
 * Le nombre nu reste accepté — c'est la forme que documente `docs/ticketing/handout-items.md`
 * et celle qu'employaient ces endpoints avant que la quantité n'existe. Il vaut un exemplaire.
 */
export const handoutItemSelectionSchema = z.union([
  z.number().int().positive(),
  z.object({
    handoutItemId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(999).optional(),
    /**
     * Les phases où l'article est remis — seuls les bénévoles s'en servent aujourd'hui.
     *
     * ⚠️ FACULTATIF, ET IGNORÉ PAR LES AUTRES PORTEURS. Les tarifs, options, spectacles et repas
     * passent par ce même schéma et leurs tables n'ont pas de colonne `phases` : ils déstructurent
     * `{ handoutItemId, quantity }` et laissent tomber le reste. L'ajouter ici plutôt que dans un
     * second schéma évite d'avoir deux normalisations — ce module raconte déjà ce qu'avait coûté
     * leur divergence passée.
     */
    phases: z.array(z.enum(PHASES_EDITION)).optional(),
  }),
])

export type HandoutItemSelection = z.infer<typeof handoutItemSelectionSchema>

export interface NormalizedHandoutItemSelection {
  handoutItemId: number
  quantity: number
  /** Vide = toutes les phases. Seuls les bénévoles le lisent. */
  phases: PhaseEdition[]
}

/**
 * Ramène les deux formes à `{ handoutItemId, quantity }`, borne la quantité et écarte les
 * doublons.
 *
 * **La seule normalisation du système.** Il y en avait deux, de comportements différents : celle-ci
 * dédoublonnait sans borner, sa jumelle bornait sans dédoublonner — et c'était la jumelle
 * qu'employaient la création et la mise à jour des tarifs, des options, des spectacles et des
 * repas. Un même article envoyé deux fois y violait l'index unique au `createMany`, soit un 500
 * là où le résultat attendu était parfaitement calculable.
 *
 * La déduplication n'est donc pas cosmétique : `TicketingTierHandoutItem` et ses équivalents
 * portent tous un index unique sur `(porteur, handoutItemId)`. Le dernier exemplaire l'emporte,
 * comme le ferait une saisie corrigée dans la modale.
 *
 * La borne, elle, protège du chemin qui n'a pas de schéma zod : une quantité nulle, négative ou
 * fractionnaire vaut un exemplaire, jamais zéro — on ne remet pas « zéro bracelet ».
 */
export function normalizeHandoutItemSelections(
  entries: HandoutItemSelection[] | undefined | null
): NormalizedHandoutItemSelection[] {
  if (!entries) return []

  const parEntree = new Map<number, NormalizedHandoutItemSelection>()

  for (const entry of entries) {
    const normalized =
      typeof entry === 'number'
        ? { handoutItemId: entry, quantity: 1, phases: [] }
        : {
            handoutItemId: entry.handoutItemId,
            quantity: Math.max(1, Math.trunc(entry.quantity ?? 1) || 1),
            // Normalisé ici plutôt qu'au point d'écriture : la forme nue (un simple nombre) doit
            // rendre la même structure que la forme objet, sans quoi l'appelant devrait savoir
            // laquelle il a reçue.
            phases: normaliserPhases(entry.phases),
          }
    parEntree.set(normalized.handoutItemId, normalized)
  }

  return [...parEntree.values()]
}
