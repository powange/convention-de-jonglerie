import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

const voteSchema = z.object({
  applicationId: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
})

/**
 * Soumettre ou modifier un vote sur une candidature
 * Accessible à tout utilisateur authentifié disposant du token
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const token = getRouterParam(event, 'token')

    if (!token) {
      throw createError({ status: 400, message: 'Token manquant' })
    }

    const body = await readBody(event)
    const { applicationId, score } = voteSchema.parse(body)

    // Chercher le show call par son token
    const showCall = await prisma.editionShowCall.findUnique({
      where: { surveyToken: token },
      select: { id: true, surveyOpen: true },
    })

    if (!showCall) {
      throw createError({ status: 404, message: 'Sondage non trouvé' })
    }

    if (!showCall.surveyOpen) {
      throw createError({ status: 403, message: 'Le sondage est fermé' })
    }

    // Vérifier que la candidature appartient bien à cet appel et est en attente
    const application = await prisma.showApplication.findFirst({
      where: {
        id: applicationId,
        showCallId: showCall.id,
        status: 'PENDING',
      },
      // `userId` est demandé pour la garde ci-dessous, et pour elle seule.
      select: { id: true, userId: true },
    })

    if (!application) {
      throw createError({ status: 404, message: 'Candidature non trouvée ou non éligible' })
    }

    /*
     * ⚠️ ON NE NOTE PAS SA PROPRE CANDIDATURE.
     *
     * Le sondage est ouvert à TOUT utilisateur connecté qui possède le jeton, et c'est voulu : il
     * sert à un jury informel qu'on constitue en partageant un lien, sans gérer de comptes. Mais
     * `user.id` ne servait qu'à IDENTIFIER le votant — il n'était jamais comparé à
     * `application.userId`. Un artiste ayant candidaté à cet appel pouvait donc se mettre la note
     * maximale, et son vote comptait dans la moyenne comme les autres.
     *
     * 📍 Un 403 et non un 404 : la candidature existe, et le demandeur sait parfaitement qu'elle
     * est la sienne. Un 404 ici ne cacherait rien et rendrait le refus incompréhensible.
     */
    if (application.userId === user.id) {
      throw createError({
        status: 403,
        message: 'Vous ne pouvez pas noter votre propre candidature',
      })
    }

    // Upsert du vote
    const vote = await prisma.showCallSurveyVote.upsert({
      where: {
        showCallId_applicationId_userId: {
          showCallId: showCall.id,
          applicationId,
          userId: user.id,
        },
      },
      update: { score },
      create: {
        showCallId: showCall.id,
        applicationId,
        userId: user.id,
        score,
      },
    })

    return createSuccessResponse({
      vote: {
        applicationId: vote.applicationId,
        score: vote.score,
      },
    })
  },
  { operationName: 'SubmitSurveyVote' }
)
