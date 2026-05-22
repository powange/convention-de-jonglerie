import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/shows-call/technical-needs
 *
 * Renvoie les besoins techniques de toutes les candidatures ACCEPTÉES
 * aux appels à spectacles de l'édition, regroupées par spectacle lié.
 *
 * Les candidatures acceptées sans `showId` sont retournées dans un groupe
 * dédié `show: null`. Utilisé pour la génération PDF côté client.
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
        message: "Vous n'avez pas les droits pour gérer les appels à spectacles de cette édition",
      })
    }

    const applications = await prisma.showApplication.findMany({
      where: {
        status: 'ACCEPTED',
        showCall: { editionId },
      },
      select: {
        id: true,
        artistName: true,
        showTitle: true,
        technicalNeeds: true,
        showId: true,
        // `editionId` est inclus pour vérifier que le Show lié appartient
        // bien à l'édition courante (défense en profondeur — le schéma
        // n'empêche pas un `showId` pointant vers une autre édition).
        show: { select: { id: true, title: true, editionId: true } },
      },
      orderBy: [{ artistName: 'asc' }],
    })

    // Regroupement par showId. `null` = candidatures acceptées sans
    // spectacle lié (ou avec un show d'une autre édition — défense en
    // profondeur, traitées comme orphelines pour ne pas fuiter d'info).
    type Group = {
      show: { id: number; title: string } | null
      applications: Array<{
        id: number
        artistName: string
        showTitle: string
        technicalNeeds: string | null
      }>
    }
    const byShowId = new Map<number | 'none', Group>()
    for (const app of applications) {
      const showBelongsToEdition = app.show && app.show.editionId === editionId
      const key: number | 'none' = showBelongsToEdition ? app.show!.id : 'none'
      let group = byShowId.get(key)
      if (!group) {
        group = {
          show: showBelongsToEdition ? { id: app.show!.id, title: app.show!.title } : null,
          applications: [],
        }
        byShowId.set(key, group)
      }
      group.applications.push({
        id: app.id,
        artistName: app.artistName,
        showTitle: app.showTitle,
        technicalNeeds: app.technicalNeeds,
      })
    }

    // Ordre final : groupes avec show triés par titre, puis le groupe « sans show »
    // à la fin (pour ne pas le perdre visuellement en tête de PDF).
    const groups: Group[] = Array.from(byShowId.values())
      .filter((g): g is Group & { show: { id: number; title: string } } => g.show !== null)
      .sort((a, b) => a.show.title.localeCompare(b.show.title))
    const orphanGroup = byShowId.get('none')
    if (orphanGroup) groups.push(orphanGroup)

    return createSuccessResponse({
      editionName: edition.name ?? edition.convention?.name ?? '',
      groups,
    })
  },
  { operationName: 'GetShowApplicationsTechnicalNeeds' }
)
