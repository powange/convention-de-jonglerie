import { wrapApiHandler } from '#server/utils/api-helpers'
import { destinationSurPlace, periodeEdition } from '~~/shared/utils/presence-edition'

/**
 * GET /api/editions/en-cours-localisees
 *
 * Les éditions sur lesquelles l'utilisateur pourrait se trouver en ce moment, et dont l'adresse
 * est géolocalisée, afin que le navigateur puisse déterminer seul s'il y est.
 *
 * Le rapprochement se fait côté client, volontairement : la position de l'utilisateur n'est ni
 * transmise ni conservée. Il n'y a qu'une poignée d'éditions concernées à un instant donné, si
 * bien que les envoyer toutes coûte moins qu'un aller-retour transportant une donnée sensible.
 *
 * La fenêtre déborde les dates publiques : le montage précède l'édition et le démontage la suit,
 * parfois de plusieurs jours, et il s'y trouve du monde. Mais pendant ces deux périodes la
 * convention n'est pas ouverte — seuls y sont annoncés ceux qui ont une raison d'y être, ce que
 * `destinationSurPlace` tranche.
 *
 * Route publique — un visiteur non connecté a autant besoin d'être orienté vers l'édition où il
 * se trouve — mais la session est hydratée quand elle existe, pour connaître son rôle.
 */
export default wrapApiHandler(
  async (event) => {
    const maintenant = new Date()

    const editions = await prisma.edition.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        // Une édition hors ligne ou annulée n'a pas à être proposée, même si l'on est sur place.
        status: { in: ['PUBLISHED', 'PLANNED'] },
        // Les trois périodes, exprimées en base plutôt que filtrées après coup : le montage et le
        // démontage sont facultatifs et indépendants l'un de l'autre, si bien qu'un simple
        // intervalle « du début du montage à la fin du démontage » laisserait de côté les
        // éditions qui n'en déclarent qu'un seul.
        OR: [
          { startDate: { lte: maintenant }, endDate: { gte: maintenant } },
          {
            startDate: { gt: maintenant },
            event: { volunteerSettings: { setupStartDate: { lte: maintenant } } },
          },
          {
            endDate: { lt: maintenant },
            event: { volunteerSettings: { teardownEndDate: { gte: maintenant } } },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        eventId: true,
        conventionId: true,
        creatorId: true,
        startDate: true,
        endDate: true,
        convention: { select: { name: true, authorId: true } },
        event: {
          select: {
            volunteerSettings: { select: { setupStartDate: true, teardownEndDate: true } },
          },
        },
      },
    })

    const userId = event.context.user?.id ?? null

    // Un bénévole accepté est emmené sur la page bénévolat plutôt que sur celle de l'édition :
    // sur place, c'est son planning qu'il vient chercher.
    let eventIdsBenevole = new Set<number>()
    // Les conventions dont il est organisateur : sur place, il travaille, et c'est la page de
    // gestion qui lui sert. Le rattachement suffit — un organisateur sans aucun droit coché
    // accède déjà à l'accueil de gestion.
    //
    // Le mode administrateur n'entre volontairement pas en compte : un super-administrateur de
    // passage sur un site n'y est pas organisateur, et l'y envoyer en gestion n'aurait pas de
    // sens. Il reste traité comme n'importe quel visiteur.
    let conventionIdsOrganisateur = new Set<number>()

    if (userId && editions.length > 0) {
      const [candidatures, rattachements] = await Promise.all([
        prisma.editionVolunteerApplication.findMany({
          where: {
            userId,
            status: 'ACCEPTED',
            eventId: { in: editions.map((e) => e.eventId) },
          },
          select: { eventId: true },
        }),
        prisma.conventionOrganizer.findMany({
          where: {
            userId,
            conventionId: { in: [...new Set(editions.map((e) => e.conventionId))] },
          },
          select: { conventionId: true },
        }),
      ])
      eventIdsBenevole = new Set(candidatures.map((c) => c.eventId))
      conventionIdsOrganisateur = new Set(rattachements.map((r) => r.conventionId))
    }

    const resultats = editions.flatMap((edition) => {
      const periode = periodeEdition(maintenant, {
        startDate: edition.startDate,
        endDate: edition.endDate,
        setupStartDate: edition.event?.volunteerSettings?.setupStartDate,
        teardownEndDate: edition.event?.volunteerSettings?.teardownEndDate,
      })
      // La requête a déjà écarté le reste ; ce repli ne couvre qu'une bascule de seconde entre
      // les deux instants.
      if (!periode) return []

      const estOrganisateur =
        userId !== null &&
        (edition.creatorId === userId ||
          edition.convention?.authorId === userId ||
          conventionIdsOrganisateur.has(edition.conventionId))

      const destination = destinationSurPlace(edition.id, periode, {
        estOrganisateur,
        estBenevole: eventIdsBenevole.has(edition.eventId),
      })
      // Rien à proposer : un visiteur sur le terrain pendant le montage n'a pas à être annoncé,
      // sans quoi l'interface lui promettrait une redirection qui n'aurait jamais lieu.
      if (!destination) return []

      return [
        {
          id: edition.id,
          nom: edition.name || edition.convention?.name || '',
          latitude: edition.latitude as number,
          longitude: edition.longitude as number,
          periode,
          destination,
        },
      ]
    })

    return { editions: resultats }
  },
  { operationName: 'GetEditionsEnCoursLocalisees' }
)
