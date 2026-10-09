import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { nonLusParCandidature } from '#server/utils/non-lus-de-candidature'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const applications = await prisma.showApplication.findMany({
      where: {
        userId: user.id,
      },
      // `organizerNotes` est volontairement absent : le schéma le décrit comme « Notes internes
      // organisateurs » et le champ de saisie de la fiche de gestion l'annonce comme tel à celui
      // qui écrit. Le renvoyer ici le donnait à lire à l'artiste — y compris en PENDING, où il
      // transitait dans la réponse sans être affiché. Ce qui est destiné à l'artiste passe par la
      // discussion de la candidature.
      select: {
        id: true,
        status: true,
        artistName: true,
        showTitle: true,
        showDescription: true,
        showDuration: true,
        showCategory: true,
        additionalPerformersCount: true,
        createdAt: true,
        updatedAt: true,
        decidedAt: true,
        showCall: {
          select: {
            id: true,
            name: true,
            visibility: true,
            deadline: true,
            edition: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                city: true,
                country: true,
                imageUrl: true,
                convention: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                  },
                },
              },
            },
          },
        },
        /*
         * L'identifiant de la conversation, pour y rattacher le compte de non-lus.
         * `Conversation.showApplicationId` est unique : la relation est au plus à une.
         */
        conversation: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const nonLus = await nonLusParCandidature(applications, user.id)

    return applications.map((candidature) => ({
      ...candidature,
      unreadMessages: nonLus.get(candidature.id) ?? 0,
    }))
  },
  { operationName: 'GetUserShowApplications' }
)
