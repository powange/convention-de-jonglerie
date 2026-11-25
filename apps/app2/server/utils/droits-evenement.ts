/**
 * Qui peut quoi sur un événement Flowvent — la règle écrite une fois.
 *
 * - le PROPRIÉTAIRE (créateur) peut tout, et lui seul (avec un administrateur) supprime ;
 * - un ORGANISATEUR déclaré (`EditionOrganizer`) voit la gestion, et a les droits par domaine
 *   qu'on lui a donnés : modifier l'événement, gérer les organisateurs, gérer les bénévoles ;
 * - un ADMINISTRATEUR global peut tout.
 *
 * Abonnement (décision de l'utilisateur) : c'est celui du PROPRIÉTAIRE qui ouvre la gestion de
 * l'événement, à lui comme à ses organisateurs ; un organisateur n'a pas besoin du sien.
 */
import { getActiveSubscription } from './subscription'

export interface DroitsEvenement {
  /** Voir l'événement et sa gestion. */
  voir: boolean
  /** Modifier ses informations (nom, lieu, dates, fuseau…). */
  modifier: boolean
  /** Ajouter, retirer des organisateurs et régler leurs droits. */
  organisateurs: boolean
  /** Gérer les bénévoles (tout le module). */
  benevoles: boolean
  /** Le supprimer, avec toutes ses données. */
  supprimer: boolean
  estProprietaire: boolean
}

const AUCUN: DroitsEvenement = {
  voir: false,
  modifier: false,
  organisateurs: false,
  benevoles: false,
  supprimer: false,
  estProprietaire: false,
}

export async function droitsSurEvenement(
  eventId: number,
  userId: number
): Promise<DroitsEvenement> {
  const [evenement, utilisateur, organisateur] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } }),
    prisma.editionOrganizer.findFirst({
      where: { editionId: eventId, organizer: { userId } },
      select: { canEditEvent: true, canManageOrganizers: true, canManageVolunteers: true },
    }),
  ])
  if (!evenement) return AUCUN
  const estProprietaire = evenement.ownerId === userId
  const tout = estProprietaire || !!utilisateur?.isGlobalAdmin
  return {
    voir: tout || !!organisateur,
    modifier: tout || !!organisateur?.canEditEvent,
    organisateurs: tout || !!organisateur?.canManageOrganizers,
    benevoles: tout || !!organisateur?.canManageVolunteers,
    supprimer: tout,
    estProprietaire,
  }
}

/**
 * La gestion de l'événement est-elle ouverte ? Oui si le propriétaire a un abonnement actif — ou
 * si la personne est administrateur.
 */
export async function gestionOuverte(eventId: number, userId: number): Promise<boolean> {
  const [evenement, utilisateur] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } }),
  ])
  if (!evenement) return false
  if (utilisateur?.isGlobalAdmin) return true
  return !!(await getActiveSubscription(evenement.ownerId))
}
