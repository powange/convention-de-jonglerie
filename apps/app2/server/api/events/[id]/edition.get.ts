import { optionalAuth } from '#server/utils/auth-utils'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

/**
 * L'événement sous la forme « édition » qu'attend l'interface du layer bénévoles (cf.
 * app/stores/editions.ts). Distinct de `GET /api/events/:id`, réservé au propriétaire : la page du
 * BÉNÉVOLE doit pouvoir afficher l'événement.
 *
 * Visible par : qui gère l'événement, qui y a candidaté, et tout le monde si sa page bénévoles est
 * publique ou ses candidatures ouvertes. Sinon 404 — l'existence de l'événement ne se devine pas.
 * Rien d'autre que des métadonnées d'affichage : pas d'adresse e-mail, pas de données de compte.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ status: 400, message: 'Identifiant invalide' })
  }

  const evenement = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      location: true,
      startDate: true,
      endDate: true,
      timezone: true,
      status: true,
      ownerId: true,
      volunteerSettings: {
        select: {
          pagePublic: true,
          open: true,
          mode: true,
          organizersInTeams: true,
          setupStartDate: true,
          teardownEndDate: true,
          swapsEnabled: true,
        },
      },
      // Pour la barre latérale de gestion : l'entrée « Renforts » n'a lieu d'être qu'avec une
      // équipe volante (même règle qu'app1).
      _count: { select: { volunteerTeams: { where: { isFloatingTeam: true } } } },
    },
  })
  if (!evenement) throw createError({ status: 404, message: 'Événement introuvable' })

  const user = optionalAuth(event)
  const gere = user ? await canManageEditionVolunteers(id, user.id, event) : false
  const aCandidate = user
    ? !!(await prisma.editionVolunteerApplication.findFirst({
        where: { eventId: id, userId: user.id },
        select: { id: true },
      }))
    : false
  const s = evenement.volunteerSettings
  if (!gere && !aCandidate && !s?.pagePublic && !s?.open) {
    throw createError({ status: 404, message: 'Événement introuvable' })
  }

  return {
    id: evenement.id,
    name: evenement.name,
    description: evenement.description,
    location: evenement.location,
    startDate: evenement.startDate,
    // Un événement Flowvent sans date de fin dure une journée.
    endDate: evenement.endDate ?? evenement.startDate,
    timezone: evenement.timezone ?? 'Europe/Paris',
    status: evenement.status,
    // Vocabulaire d'app1 attendu par l'interface du layer : le propriétaire tient lieu de
    // créateur de l'édition et d'auteur de la « convention » (qui n'est ici que l'événement).
    creatorId: evenement.ownerId,
    convention: { name: evenement.name, authorId: evenement.ownerId, organizers: [] },
    // Calculé côté serveur : l'interface n'a pas à connaître la règle des droits.
    peutGererBenevoles: gere,
    volunteersMode: s?.mode ?? 'INTERNAL',
    volunteersOrganizersInTeams: s?.organizersInTeams ?? false,
    volunteersSetupStartDate: s?.setupStartDate ?? null,
    volunteersTeardownEndDate: s?.teardownEndDate ?? null,
    volunteersSwapsEnabled: s?.swapsEnabled ?? true,
    volunteersHasFloatingTeam: evenement._count.volunteerTeams > 0,
    // Flowvent n'a pas de module repas.
    mealsEnabled: false,
  }
})
