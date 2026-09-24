import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { numerosOrphelinsApresSuppression } from '~~/shared/utils/suppression-artiste'

/**
 * Ce que la suppression de cet artiste laisserait derrière elle.
 *
 * Appelé avant d'ouvrir la modale de confirmation, pour qu'elle propose d'emporter les numéros
 * devenus muets. L'écran ne peut pas le calculer seul : la liste des artistes charge les spectacles
 * avec `distinct: ['showId']`, ce qui écrase justement le détail des numéros et ignore combien
 * d'autres artistes y figurent.
 *
 * Point d'API de LECTURE : il ne supprime rien et ne décide de rien. C'est la suppression
 * elle-même qui revérifiera ce qu'on lui demande d'emporter — sinon il suffirait d'envoyer
 * l'identifiant d'un spectacle quelconque pour le faire disparaître par cet écran.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    const artiste = await prisma.editionArtist.findFirst({
      where: { id: artistId, editionId },
      select: { id: true },
    })
    if (!artiste) {
      throw createError({ status: 404, message: 'Artiste non trouvé' })
    }

    /*
     * Les spectacles où cet artiste intervient, avec TOUS les liens de leurs numéros.
     *
     * Il faut les liens des autres artistes autant que les siens : c'est leur absence qui rend un
     * numéro orphelin. Ne charger que ses liens à lui aurait déclaré orphelin tout numéro auquel il
     * participe, y compris ceux qu'il partage.
     */
    const spectacles = await prisma.show.findMany({
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
          orderBy: { position: 'asc' },
        },
      },
    })

    const orphelins = numerosOrphelinsApresSuppression(
      spectacles.map((spectacle) => ({
        id: spectacle.id,
        title: spectacle.title,
        numeros: spectacle.acts.map((acte) => ({
          id: acte.id,
          title: acte.title,
          showId: acte.showId,
          liens: acte.artists,
        })),
      })),
      artistId
    )

    return createSuccessResponse({ numerosOrphelins: orphelins })
  },
  { operationName: 'GetArtistDeletionImpact' }
)
