import { z } from 'zod'

import type { Prisma } from '#server/types/prisma'

/**
 * Un numéro de spectacle cabaret, tel qu'envoyé par le client.
 * La position n'est pas transmise : elle est dérivée de l'ordre du tableau, ce qui évite
 * les trous et les doublons qu'un champ libre finirait par produire.
 */
export const showActSchema = z.object({
  /**
   * Identifiant d'un numéro déjà enregistré, renvoyé tel quel par le client.
   *
   * Sans lui, la recomposition ne pouvait que tout supprimer puis tout recréer : les numéros
   * changeaient d'identifiant à chaque enregistrement, et un artiste en train de saisir ses
   * besoins techniques voyait sa ligne disparaître sous lui — au mieux un « Numéro introuvable »,
   * au pire l'attente d'un verrou jusqu'à expiration, vue en production.
   *
   * Absent pour un numéro nouveau. Sa présence ne vaut pas confiance : le serveur vérifie qu'il
   * appartient bien au spectacle avant de s'en servir.
   */
  id: z.number().int().positive().optional(),
  // 191 et non 255 : c'est la taille de la colonne, un titre plus long ferait échouer
  // l'écriture au milieu de la recomposition
  title: z.string().min(1, 'Le titre du numéro est requis').max(191),
  duration: z.number().int().positive().max(1440).optional().nullable(),
  // Plafonds alignés sur ceux de la candidature (validation-schemas) pour qu'un numéro importé
  // depuis une candidature reste éditable/ré-enregistrable via le formulaire.
  description: z.string().max(5000).optional().nullable(),
  technicalNeeds: z.string().max(3000).optional().nullable(),
  stageSetup: z.string().max(3000).optional().nullable(),
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
 * Les numéros, eux, sont **mis à jour sur place** quand le client renvoie leur identifiant : ils
 * gardent le leur d'un enregistrement à l'autre. La table rase d'autrefois avait deux défauts —
 * elle invalidait les identifiants sous les autres utilisateurs, et son `deleteMany` verrouillait
 * toutes les lignes du spectacle le temps de la transaction, jusqu'à faire expirer l'attente d'un
 * artiste qui enregistrait ses besoins techniques au même moment.
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
  // Les liens artiste sont refaits entièrement : personne ne les édite en parallèle, et ils ne
  // portent pas d'identifiant que quiconque conserverait.
  await client.showArtist.deleteMany({ where: { showId } })

  if (type === 'CABARET') {
    // Parmi les identifiants reçus, ceux qui appartiennent réellement à ce spectacle. Un
    // identifiant qui n'y figure pas est traité comme un numéro nouveau : sans cette
    // vérification, il suffirait d'en inventer un pour réécrire le numéro d'un autre spectacle.
    //
    // La requête est restreinte aux identifiants reçus, et sautée quand il n'y en a aucun —
    // à la création d'un spectacle, il n'y a rien à retrouver.
    const idsRecus = acts.map((a) => a.id).filter((id): id is number => typeof id === 'number')
    const idsDuSpectacle = new Set(
      idsRecus.length > 0
        ? (
            await client.showAct.findMany({
              where: { showId, id: { in: idsRecus } },
              select: { id: true },
            })
          ).map((a) => a.id)
        : []
    )
    const conserves: number[] = []

    for (const [index, act] of acts.entries()) {
      const donnees = {
        title: act.title,
        position: index,
        duration: act.duration ?? null,
        description: act.description ?? null,
        technicalNeeds: act.technicalNeeds ?? null,
        stageSetup: act.stageSetup ?? null,
      }

      const idReutilisable = act.id && idsDuSpectacle.has(act.id) ? act.id : null
      const numero = idReutilisable
        ? await client.showAct.update({ where: { id: idReutilisable }, data: donnees })
        : await client.showAct.create({ data: { showId, ...donnees } })
      conserves.push(numero.id)

      // showId est renseigné en plus de actId : c'est lui qui répond à « à quels spectacles
      // cet artiste participe-t-il ? », question posée par la billetterie et l'espace artiste.
      const uniqueArtistIds = [...new Set(act.artistIds ?? [])]
      if (uniqueArtistIds.length > 0) {
        await client.showArtist.createMany({
          data: uniqueArtistIds.map((artistId) => ({ showId, actId: numero.id, artistId })),
        })
      }
    }

    // Ce que le client n'a pas renvoyé a été supprimé de son côté.
    // La condition est construite d'abord : donner deux formes d'argument différentes selon le
    // cas empêchait Prisma d'en déduire une seule.
    const aSupprimer = conserves.length > 0 ? { showId, id: { notIn: conserves } } : { showId }
    await client.showAct.deleteMany({ where: aSupprimer })
    return
  }

  // Un spectacle STANDARD ne porte aucun numéro : ceux d'un ancien cabaret doivent disparaître.
  await client.showAct.deleteMany({ where: { showId } })

  const uniqueArtistIds = [...new Set(artistIds)]
  if (uniqueArtistIds.length > 0) {
    await client.showArtist.createMany({
      data: uniqueArtistIds.map((artistId) => ({ showId, artistId })),
    })
  }
}
