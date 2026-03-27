import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * Récupère les données d'un sondage de candidatures spectacles
 * Accessible à tout utilisateur authentifié disposant du token
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const token = getRouterParam(event, 'token')

    if (!token) {
      throw createError({ status: 400, message: 'Token manquant' })
    }

    // Chercher le show call par son token de sondage
    const showCall = await prisma.editionShowCall.findUnique({
      where: { surveyToken: token },
      select: {
        id: true,
        name: true,
        surveyOpen: true,
        edition: {
          select: {
            id: true,
            name: true,
            convention: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!showCall) {
      throw createError({ status: 404, message: 'Sondage non trouvé' })
    }

    // Récupérer les candidatures en attente avec infos artiste/spectacle
    const applications = await prisma.showApplication.findMany({
      where: {
        showCallId: showCall.id,
        status: 'PENDING',
      },
      select: {
        id: true,
        artistName: true,
        artistBio: true,
        portfolioUrl: true,
        videoUrl: true,
        socialLinks: true,
        showTitle: true,
        showDescription: true,
        showDuration: true,
        showCategory: true,
        additionalPerformersCount: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Récupérer les votes de l'utilisateur courant
    const userVotes = await prisma.showCallSurveyVote.findMany({
      where: {
        showCallId: showCall.id,
        userId: user.id,
      },
      select: {
        applicationId: true,
        score: true,
      },
    })

    // Construire la map des votes de l'utilisateur
    const myVotes: Record<number, number> = {}
    for (const vote of userVotes) {
      myVotes[vote.applicationId] = vote.score
    }

    // Si le sondage est fermé, inclure les résultats globaux
    let results: { applicationId: number; avgScore: number | null; voteCount: number }[] | null =
      null

    if (!showCall.surveyOpen) {
      const aggregations = await prisma.showCallSurveyVote.groupBy({
        by: ['applicationId'],
        where: { showCallId: showCall.id },
        _avg: { score: true },
        _count: { score: true },
      })

      results = aggregations.map((a) => ({
        applicationId: a.applicationId,
        avgScore: a._avg.score,
        voteCount: a._count.score,
      }))
    }

    return {
      showCall: {
        id: showCall.id,
        name: showCall.name,
        surveyOpen: showCall.surveyOpen,
        edition: showCall.edition,
      },
      applications,
      myVotes,
      results,
    }
  },
  { operationName: 'GetSurveyData' }
)
