import { z } from 'zod'

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
  }),
])

export type HandoutItemSelection = z.infer<typeof handoutItemSelectionSchema>

export interface NormalizedHandoutItemSelection {
  handoutItemId: number
  quantity: number
}

/**
 * Ramène les deux formes à `{ handoutItemId, quantity }` et écarte les doublons.
 *
 * La déduplication n'est pas cosmétique : `TicketingTierHandoutItem` et son équivalent pour les
 * options portent un index unique `(tierId, handoutItemId)`, qu'un même article envoyé deux fois
 * ferait violer au `createMany`. Le dernier exemplaire l'emporte, comme le ferait une saisie
 * corrigée dans la modale.
 */
export function normalizeHandoutItemSelections(
  entries: HandoutItemSelection[]
): NormalizedHandoutItemSelection[] {
  const parEntree = new Map<number, NormalizedHandoutItemSelection>()

  for (const entry of entries) {
    const normalized =
      typeof entry === 'number'
        ? { handoutItemId: entry, quantity: 1 }
        : { handoutItemId: entry.handoutItemId, quantity: entry.quantity ?? 1 }
    parEntree.set(normalized.handoutItemId, normalized)
  }

  return [...parEntree.values()]
}
