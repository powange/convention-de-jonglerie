import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/shows/technical-needs
 *
 * Besoins techniques de l'édition, pris directement sur les SPECTACLES (et, pour un cabaret, sur
 * chacun de ses NUMÉROS : besoins techniques + mise en place scène) — et non plus sur les
 * candidatures. Utilisé pour la génération du PDF côté client.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour gérer les spectacles de cette édition",
      })
    }

    const artistInclude = {
      select: {
        artist: { select: { user: { select: { prenom: true, nom: true, email: true } } } },
      },
    } as const

    const shows = await prisma.show.findMany({
      where: { editionId },
      orderBy: { title: 'asc' },
      select: {
        title: true,
        // Le déroulé des numéros ne change pas d'un passage à l'autre : la feuille technique
        // décrit l'œuvre. Les dates sont rappelées pour situer les passages sur le terrain.
        performances: { select: { startDateTime: true }, orderBy: { startDateTime: 'asc' } },
        type: true,
        technicalNeeds: true,
        // Artistes au niveau du spectacle (spectacle STANDARD ; un cabaret les porte dans ses numéros).
        artists: { where: { actId: null }, ...artistInclude },
        acts: {
          orderBy: { position: 'asc' },
          select: {
            title: true,
            technicalNeeds: true,
            stageSetup: true,
            artists: artistInclude,
          },
        },
      },
    })

    const nameOf = (u: { prenom: string | null; nom: string | null; email: string }) =>
      `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email

    const mappedShows = shows.map((s) => ({
      title: s.title,
      type: s.type,
      performances: s.performances.map((p) => p.startDateTime),
      technicalNeeds: s.technicalNeeds,
      artists: s.artists.map((sa) => nameOf(sa.artist.user)),
      acts: s.acts.map((a) => ({
        title: a.title,
        technicalNeeds: a.technicalNeeds,
        stageSetup: a.stageSetup,
        artists: a.artists.map((sa) => nameOf(sa.artist.user)),
      })),
    }))

    // Tri sur le premier passage : c'est l'ordre dans lequel la régie vit la soirée.
    mappedShows.sort(
      (a, b) =>
        (a.performances[0]?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.performances[0]?.getTime() ?? Number.POSITIVE_INFINITY) ||
        a.title.localeCompare(b.title)
    )

    return createSuccessResponse({
      editionName: edition.name ?? edition.convention?.name ?? '',
      shows: mappedShows,
    })
  },
  { operationName: 'GetShowsTechnicalNeeds' }
)
