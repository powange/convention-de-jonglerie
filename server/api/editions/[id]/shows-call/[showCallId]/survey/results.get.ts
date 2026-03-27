import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({ status: 400, message: "ID de l'appel à spectacles invalide" })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) throw createError({ status: 404, message: 'Édition non trouvée' })
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour voir les résultats",
      })
    }

    const showCall = await prisma.editionShowCall.findFirst({
      where: { id: showCallId, editionId },
      select: { id: true, surveyToken: true, surveyOpen: true },
    })
    if (!showCall) throw createError({ status: 404, message: 'Appel à spectacles non trouvé' })

    // Get all pending applications for this show call
    const applications = await prisma.showApplication.findMany({
      where: { showCallId: showCall.id },
      select: {
        id: true,
        artistName: true,
        showTitle: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get aggregated vote results
    const aggregations = await prisma.showCallSurveyVote.groupBy({
      by: ['applicationId'],
      where: { showCallId: showCall.id },
      _avg: { score: true },
      _count: { score: true },
    })

    // Merge applications with their vote results
    const aggregationMap = new Map(
      aggregations.map((a) => [
        a.applicationId,
        { avgScore: a._avg.score, voteCount: a._count.score },
      ])
    )

    const results = applications.map((app) => ({
      applicationId: app.id,
      artistName: app.artistName,
      showTitle: app.showTitle,
      status: app.status,
      avgScore: aggregationMap.get(app.id)?.avgScore ?? null,
      voteCount: aggregationMap.get(app.id)?.voteCount ?? 0,
    }))

    const config = useRuntimeConfig()
    const baseUrl = config.public?.siteUrl || `http://localhost:3000`

    return {
      surveyOpen: showCall.surveyOpen,
      surveyToken: showCall.surveyToken,
      surveyUrl: showCall.surveyToken ? `${baseUrl}/survey/${showCall.surveyToken}` : null,
      results,
    }
  },
  { operationName: 'GetSurveyResults' }
)
