import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import {
  numerosOrphelinsApresSuppression,
  spectaclesVidesApresRetrait,
} from '~~/shared/utils/suppression-artiste'

/**
 * Ce que l'écran demande d'emporter avec l'artiste.
 *
 * Tout est facultatif, et un corps absent reste parfaitement valable : les appels qui ne
 * connaissent pas ces champs continuent de supprimer le seul artiste, comme avant.
 */
const corpsSchema = z
  .object({
    /** Les numéros devenus muets qu'on accepte de supprimer. */
    actIds: z.array(z.number().int().positive()).max(100).optional(),
    /** Les cabarets qu'on accepte de supprimer s'ils se retrouvent vides. */
    showIds: z.array(z.number().int().positive()).max(100).optional(),
  })
  .optional()

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

    // Vérifier les permissions (util core via #server ; le layer ne lit pas Edition directement)
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    const hasPermission = canManageArtists(edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    // Vérifier que l'artiste existe et appartient à cette édition
    const existingArtist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!existingArtist) {
      throw createError({
        status: 404,
        message: 'Artiste non trouvé',
      })
    }

    const demande = corpsSchema.parse(await readBody(event).catch(() => undefined)) ?? {}
    const actIdsDemandes = demande.actIds ?? []
    const showIdsDemandes = demande.showIds ?? []

    /*
     * Le serveur REVÉRIFIE ce qu'on lui demande d'emporter.
     *
     * Exécuter la liste telle qu'elle arrive ferait de ce point d'API un moyen détourné de
     * supprimer n'importe quel numéro ou spectacle de l'édition : il suffirait d'en glisser
     * l'identifiant à la suppression d'un artiste. On recalcule donc, ici, ce qui devient
     * réellement orphelin — et l'on ne retient de la demande que l'intersection.
     */
    const spectacles = (
      await prisma.show.findMany({
        where: { editionId, artists: { some: { artistId } } },
        select: {
          id: true,
          title: true,
          acts: {
            select: {
              id: true,
              title: true,
              showId: true,
              artists: { select: { artistId: true, actId: true } },
            },
          },
        },
      })
    ).map((spectacle) => ({
      id: spectacle.id,
      title: spectacle.title,
      numeros: spectacle.acts.map((acte) => ({
        id: acte.id,
        title: acte.title,
        showId: acte.showId,
        liens: acte.artists,
      })),
    }))

    const orphelinsReels = new Set(
      numerosOrphelinsApresSuppression(spectacles, artistId).map((n) => n.actId)
    )
    const numerosASupprimer = actIdsDemandes.filter((id) => orphelinsReels.has(id))

    const videsReels = new Set(spectaclesVidesApresRetrait(spectacles, numerosASupprimer))
    const spectaclesASupprimer = showIdsDemandes.filter((id) => videsReels.has(id))

    /*
     * Dans cet ordre, et sous une seule transaction.
     *
     * Supprimer un spectacle emporte ses numéros en cascade ; l'inverse n'est pas vrai. Et une
     * suppression partielle — l'artiste parti, son numéro resté — laisserait l'organisateur devant
     * un écran qui ne correspond ni à ce qu'il a demandé ni à ce qu'il voyait.
     */
    await prisma.$transaction(async (tx) => {
      await tx.editionArtist.delete({ where: { id: artistId } })
      if (numerosASupprimer.length > 0) {
        await tx.showAct.deleteMany({ where: { id: { in: numerosASupprimer } } })
      }
      if (spectaclesASupprimer.length > 0) {
        await tx.show.deleteMany({ where: { id: { in: spectaclesASupprimer } } })
      }
    })

    return createSuccessResponse(
      { numerosSupprimes: numerosASupprimer, spectaclesSupprimes: spectaclesASupprimer },
      'Artiste supprimé avec succès'
    )
  },
  { operationName: 'DeleteArtist' }
)
