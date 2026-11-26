import { droitsSurEvenement } from '../../../../utils/droits-evenement'

/**
 * Les organisateurs d'un événement Flowvent, sous la forme qu'attendent les écrans de la
 * billetterie (quotas et articles à remettre par organisateur) — le pendant du point d'app1, qui
 * vit dans l'app (son modèle d'organisateurs, par convention, n'est pas celui de Flowvent).
 *
 * Même règle d'accès qu'app1 : gérer les organisateurs OU la billetterie. L'adresse et le
 * téléphone, seulement pour qui gère les organisateurs.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const editionId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(editionId))
    throw createError({ status: 400, message: 'Identifiant invalide' })

  const droits = await droitsSurEvenement(editionId, userId)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.organisateurs && !droits.billetterie) {
    throw createError({ status: 403, message: 'Droits insuffisants' })
  }

  const lignes = await prisma.editionOrganizer.findMany({
    where: { editionId },
    select: {
      id: true,
      organizerId: true,
      entryValidated: true,
      entryValidatedAt: true,
      arrivalDateTime: true,
      departureDateTime: true,
      createdAt: true,
      teamAssignments: {
        select: { isLeader: true, team: { select: { id: true, name: true, color: true } } },
      },
      organizer: {
        select: {
          user: {
            select: {
              id: true,
              pseudo: true,
              prenom: true,
              nom: true,
              pronouns: true,
              emailHash: true,
              profilePicture: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { organizer: { user: { nom: 'asc' } } },
  })

  return createSuccessResponse({
    organizers: lignes.map((eo) => {
      const { email, phone, ...compte } = eo.organizer.user
      return {
        id: eo.id,
        organizerId: eo.organizerId,
        roles: [],
        entryValidated: eo.entryValidated,
        entryValidatedAt: eo.entryValidatedAt,
        arrivalDateTime: eo.arrivalDateTime,
        departureDateTime: eo.departureDateTime,
        createdAt: eo.createdAt,
        title: null,
        // Pas de module repas avant le lot 7.
        meals: { accepted: 0, total: 0 },
        teams: eo.teamAssignments.map((r) => ({ ...r.team, isLeader: r.isLeader })),
        user: { ...compte, ...(droits.organisateurs ? { email, phone } : {}) },
      }
    }),
    total: lignes.length,
  })
})
