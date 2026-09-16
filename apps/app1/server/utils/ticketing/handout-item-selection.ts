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
        ? { handoutItemId: entry, quantity: 1 }
        : {
            handoutItemId: entry.handoutItemId,
            quantity: Math.max(1, Math.trunc(entry.quantity ?? 1) || 1),
          }
    parEntree.set(normalized.handoutItemId, normalized)
  }

  return [...parEntree.values()]
}
