import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * GET /api/editions/en-cours-localisees
 *
 * Les éditions qui se déroulent en ce moment et dont l'adresse est géolocalisée, afin que le
 * navigateur puisse déterminer seul si l'utilisateur s'y trouve.
 *
 * Le rapprochement se fait côté client, volontairement : la position de l'utilisateur n'est ni
 * transmise ni conservée. Il n'y a qu'une poignée d'éditions en cours à un instant donné, si bien
 * que les envoyer toutes coûte moins qu'un aller-retour transportant une donnée sensible.
 *
 * Route publique — un visiteur non connecté a autant besoin d'être orienté vers l'édition où il se
 * trouve — mais la session est hydratée quand elle existe, pour savoir s'il y est bénévole.
 */
export default wrapApiHandler(
  async (event) => {
    const maintenant = new Date()

    const editions = await prisma.edition.findMany({
      where: {
        startDate: { lte: maintenant },
        endDate: { gte: maintenant },
        latitude: { not: null },
        longitude: { not: null },
        // Une édition hors ligne ou annulée n'a pas à être proposée, même si l'on est sur place.
        status: { in: ['PUBLISHED', 'PLANNED'] },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        eventId: true,
        convention: { select: { name: true } },
      },
    })

    const userId = event.context.user?.id ?? null

    // Un bénévole accepté est emmené sur la page bénévolat plutôt que sur celle de l'édition :
    // sur place, c'est son planning qu'il vient chercher.
    let eventIdsBenevole = new Set<number>()
    if (userId && editions.length > 0) {
      const candidatures = await prisma.editionVolunteerApplication.findMany({
        where: {
          userId,
          status: 'ACCEPTED',
          eventId: { in: editions.map((e) => e.eventId) },
        },
        select: { eventId: true },
      })
      eventIdsBenevole = new Set(candidatures.map((c) => c.eventId))
    }

    return {
      editions: editions.map((edition) => ({
        id: edition.id,
        nom: edition.name || edition.convention?.name || '',
        latitude: edition.latitude as number,
        longitude: edition.longitude as number,
        estBenevole: eventIdsBenevole.has(edition.eventId),
      })),
    }
  },
  { operationName: 'GetEditionsEnCoursLocalisees' }
)
