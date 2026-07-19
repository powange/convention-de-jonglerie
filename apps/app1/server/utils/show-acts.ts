import { z } from 'zod'

import type { Prisma } from '@prisma/client'

/**
 * Un numéro de spectacle cabaret, tel qu'envoyé par le client.
 * La position n'est pas transmise : elle est dérivée de l'ordre du tableau, ce qui évite
 * les trous et les doublons qu'un champ libre finirait par produire.
 */
export const showActSchema = z.object({
  title: z.string().min(1, 'Le titre du numéro est requis').max(255),
  duration: z.number().int().positive().max(1440).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional().default([]),
})

export type ShowActInput = z.infer<typeof showActSchema>

type PrismaClientLike = Prisma.TransactionClient | typeof prisma

/**
 * Réécrit intégralement la composition d'un spectacle : ses numéros et ses artistes.
 *
 * Les deux types s'excluent — un spectacle CABARET porte ses artistes dans ses numéros, un
 * STANDARD les porte directement — donc on repart systématiquement d'une table rase pour la
 * forme qui n'est pas retenue. Sans ça, basculer un spectacle d'un type à l'autre laisserait
 * des liens orphelins que les lectures continueraient de remonter.
 *
 * Même stratégie « supprimer puis recréer » que le reste des endpoints spectacles.
 *
 * @param client - Client Prisma ou transaction
 * @param showId - Spectacle à recomposer
 * @param type - Type retenu pour le spectacle
 * @param artistIds - Artistes du spectacle (type STANDARD uniquement)
 * @param acts - Numéros et leurs artistes (type CABARET uniquement)
 */
export async function replaceShowComposition(
  client: PrismaClientLike,
  showId: number,
  type: 'STANDARD' | 'CABARET',
  artistIds: number[] = [],
  acts: ShowActInput[] = []
): Promise<void> {
  // Supprime aussi les ShowArtist rattachés aux numéros, via la cascade sur actId
  await client.showAct.deleteMany({ where: { showId } })
  await client.showArtist.deleteMany({ where: { showId } })

  if (type === 'CABARET') {
    for (const [index, act] of acts.entries()) {
      const createdAct = await client.showAct.create({
        data: {
          showId,
          title: act.title,
          position: index,
          duration: act.duration ?? null,
          description: act.description ?? null,
        },
      })

      // showId est renseigné en plus de actId : c'est lui qui répond à « à quels spectacles
      // cet artiste participe-t-il ? », question posée par la billetterie et l'espace artiste.
      const uniqueArtistIds = [...new Set(act.artistIds ?? [])]
      if (uniqueArtistIds.length > 0) {
        await client.showArtist.createMany({
          data: uniqueArtistIds.map((artistId) => ({ showId, actId: createdAct.id, artistId })),
        })
      }
    }
    return
  }

  const uniqueArtistIds = [...new Set(artistIds)]
  if (uniqueArtistIds.length > 0) {
    await client.showArtist.createMany({
      data: uniqueArtistIds.map((artistId) => ({ showId, artistId })),
    })
  }
}
