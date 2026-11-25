import { optionalAuth } from '#server/utils/auth-utils'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

import { resoudreEvenement } from '../../../utils/evenement-public'

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
  // Numéro ou identifiant public, selon la règle de `resoudreEvenement` (par numéro : seulement
  // pour qui est impliqué, ce qui ferme l'énumération des pages publiques).
  const user = optionalAuth(event)
  const resolu = await resoudreEvenement(
    String(getRouterParam(event, 'id') ?? ''),
    user?.id ?? null
  )
  if (!resolu) throw createError({ status: 404, message: 'Événement introuvable' })
  const id = resolu.id

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
      publicId: true,
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

  const gere = user ? await canManageEditionVolunteers(id, user.id, event) : false
  const s = evenement.volunteerSettings

  return {
    id: evenement.id,
    publicId: evenement.publicId,
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
    // Lus par la page bénévoles du layer pour décider si elle s'ouvre à un visiteur : sans eux, la
    // page n'était JAMAIS publique dans Flowvent, même réglée comme telle.
    volunteersPagePublic: s?.pagePublic ?? false,
    volunteersOpen: s?.open ?? false,
    volunteersOrganizersInTeams: s?.organizersInTeams ?? false,
    volunteersSetupStartDate: s?.setupStartDate ?? null,
    volunteersTeardownEndDate: s?.teardownEndDate ?? null,
    volunteersSwapsEnabled: s?.swapsEnabled ?? true,
    volunteersHasFloatingTeam: evenement._count.volunteerTeams > 0,
    // Flowvent n'a pas de module repas.
    mealsEnabled: false,
  }
})
