import {
  DROITS_PAR_DOMAINE,
  droitsProposes,
  MODULES_EVENEMENT,
} from '../../../../shared/modules-evenement'
import { droitsSurEvenement, selectionModules } from '../../../utils/droits-evenement'
import { resoudreEvenement } from '../../../utils/evenement-public'

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
      ...selectionModules,
      mapPublic: true,
      externalMapProvider: true,
      externalMapRef: true,
      artistInfo: true,
      ticketingHandoutItemsEnabled: true,
      ticketingAllowOnsiteRegistration: true,
      ticketingAllowAnonymousOrders: true,
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
  // Les droits par domaine, lus par le store (`canManageStock`…) : l'interface n'a pas à connaître
  // la règle. Un visiteur n'en a aucun.
  const droits = user ? await droitsSurEvenement(id, user.id) : null
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
    // Module désactivé : ni page publique ni candidatures (les gestionnaires gardent l'aperçu).
    volunteersEnabled: evenement.volunteersEnabled,
    volunteersPagePublic: evenement.volunteersEnabled && (s?.pagePublic ?? false),
    volunteersOpen: evenement.volunteersEnabled && (s?.open ?? false),
    volunteersOrganizersInTeams: s?.organizersInTeams ?? false,
    volunteersSetupStartDate: s?.setupStartDate ?? null,
    volunteersTeardownEndDate: s?.teardownEndDate ?? null,
    volunteersSwapsEnabled: s?.swapsEnabled ?? true,
    volunteersHasFloatingTeam: evenement._count.volunteerTeams > 0,
    // Les interrupteurs des modules, sous leurs noms d'app1 (`stockEnabled`, `mealsEnabled`…) que
    // lisent les layers partagés.
    ...Object.fromEntries(MODULES_EVENEMENT.map((m) => [m.colonne, evenement[m.colonne]])),
    // Seulement les droits proposés (événement + modules portés) : aucun sur un module à venir.
    // Carte du site (layer `map`) : sa visibilité et la carte externe d'où l'on importe. Pas de
    // coordonnées : la carte s'ouvre sur son centre par défaut, puis se cadre sur les zones.
    mapPublic: evenement.mapPublic,
    externalMapProvider: evenement.externalMapProvider,
    externalMapRef: evenement.externalMapRef,
    // Artistes (layer `artists`) : le texte de l'espace artiste.
    artistInfo: evenement.artistInfo,
    // Billetterie (layer `ticketing`) : réglages lus par ses écrans, sous les noms d'app1.
    ticketingHandoutItemsEnabled: evenement.ticketingHandoutItemsEnabled,
    ticketingAllowOnsiteRegistration: evenement.ticketingAllowOnsiteRegistration,
    ticketingAllowAnonymousOrders: evenement.ticketingAllowAnonymousOrders,
    droits: droits
      ? Object.fromEntries(
          DROITS_PAR_DOMAINE.map((d) => [d.cle, droits[d.cle] && droitsProposes().includes(d)])
        )
      : null,
  }
})
