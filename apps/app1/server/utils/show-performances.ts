import { z } from 'zod'

import type { Prisma } from '@prisma/client'

type PrismaClientLike = Prisma.TransactionClient | typeof prisma

/**
 * Une représentation d'un spectacle, telle que l'envoie le client : quand, où, et si elle est
 * annoncée au public.
 *
 * La durée n'y figure pas — elle appartient à l'œuvre : un spectacle joué deux fois dure aussi
 * longtemps les deux soirs.
 */
export const showPerformanceSchema = z.object({
  startDateTime: z.string().datetime(),
  // 191 = taille de la colonne
  location: z.string().max(191).optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
})

export type ShowPerformanceInput = z.infer<typeof showPerformanceSchema>

/**
 * Au moins une représentation : un spectacle sans date n'apparaîtrait nulle part, ni au
 * programme, ni sur la carte, et son organisateur n'aurait aucun moyen de s'en apercevoir.
 */
export const showPerformancesSchema = z
  .array(showPerformanceSchema)
  .min(1, 'Un spectacle doit avoir au moins une représentation')

/**
 * Remplace les représentations d'un spectacle par celles fournies.
 *
 * Le remplacement est intégral, comme pour les numéros d'un cabaret : rapprocher l'existant du
 * nouveau demanderait une identité stable côté client, que le formulaire ne porte pas. Les
 * représentations n'étant référencées par rien d'autre, les recréer ne coûte aucune donnée.
 *
 * @param client - Client Prisma ou client transactionnel
 * @param showId - Spectacle à recomposer
 * @param performances - Représentations retenues, dans l'ordre voulu
 */
export async function replaceShowPerformances(
  client: PrismaClientLike,
  showId: number,
  performances: ShowPerformanceInput[]
): Promise<void> {
  await client.showPerformance.deleteMany({ where: { showId } })

  if (performances.length === 0) return

  await client.showPerformance.createMany({
    data: performances.map((performance) => ({
      showId,
      startDateTime: new Date(performance.startDateTime),
      location: performance.location ?? null,
      zoneId: performance.zoneId || null,
      markerId: performance.markerId || null,
      isPublic: performance.isPublic ?? false,
    })),
  })
}
