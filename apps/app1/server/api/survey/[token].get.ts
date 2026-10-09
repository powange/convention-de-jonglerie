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

    /*
     * Les candidatures en attente, SAUF celle du demandeur s'il a lui-même candidaté.
     *
     * ## ⚠️ POURQUOI SA PROPRE CANDIDATURE DISPARAÎT DE LA LISTE
     *
     * Le sondage est ouvert à tout utilisateur connecté qui possède le jeton — voulu, il sert à un
     * jury informel qu'on constitue en partageant un lien. Mais un artiste ayant candidaté à cet
     * appel y voyait sa propre fiche et pouvait se noter : `user.id` ne servait qu'à identifier le
     * votant, jamais à exclure. Le vote est désormais refusé en 403 (`vote.put.ts`), et la fiche
     * ne s'affiche plus — une case de notation qu'on ne peut pas remplir n'explique rien.
     *
     * ## 📍 CE QUE CELA NE FERME PAS, ET QUI EST ASSUMÉ
     *
     * Un artiste candidat qui détient le jeton voit toujours la bio, les liens et la description
     * de ses CONCURRENTS. C'est inhérent au dispositif — le jeton est le seul contrôle d'accès —
     * et le constat d'audit le reconnaît en parlant du « cas le plus gênant ». Fermer celui-là
     * demanderait de refuser l'accès entier à un candidat, donc de décider que le sondage n'est
     * plus un simple lien partageable. C'est une autre question.
     */
    const applications = await prisma.showApplication.findMany({
      where: {
        showCallId: showCall.id,
        status: 'PENDING',
        userId: { not: user.id },
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

    /*
     * Le demandeur a-t-il lui-même candidaté à cet appel ?
     *
     * Sert à EXPLIQUER l'absence de sa fiche. Sans cet indicateur, un artiste candidat verrait une
     * liste à laquelle il manque un élément — le sien — sans que rien ne le dise, et conclurait à
     * un défaut.
     *
     * ⚠️ Compté sur TOUS les statuts, pas seulement `PENDING` : une candidature acceptée ou
     * refusée ne figure de toute façon pas dans un sondage, et son auteur mérite la même
     * explication.
     */
    const saPropreCandidature = await prisma.showApplication.count({
      where: { showCallId: showCall.id, userId: user.id },
    })

    return {
      showCall: {
        id: showCall.id,
        name: showCall.name,
        surveyOpen: showCall.surveyOpen,
        edition: showCall.edition,
      },
      applications,
      myVotes,
      /*
       * ⚠️ LES RÉSULTATS SUIVENT LA MÊME EXCLUSION. L'agrégation porte sur toutes les
       * candidatures : la laisser entière renverrait au candidat la moyenne de SA PROPRE fiche,
       * que la liste venait justement de retirer. Rien ne l'afficherait à l'écran, mais elle
       * serait dans la réponse — et retirer une ligne de l'écran en la laissant dans la charge
       * utile n'est pas la retirer.
       */
      results: results?.filter((r) => applications.some((a) => a.id === r.applicationId)) ?? null,
      isApplicant: saPropreCandidature > 0,
    }
  },
  { operationName: 'GetSurveyData' }
)
