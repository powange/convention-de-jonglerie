/**
 * Qui peut quoi sur un événement Flowvent — la règle écrite une fois.
 *
 * - le PROPRIÉTAIRE (créateur) peut tout, et lui seul (avec un administrateur) supprime ;
 * - un ORGANISATEUR déclaré (`EditionOrganizer`) gère l'événement ; ses droits par domaine
 *   (modifier l'événement, gérer les organisateurs, gérer les bénévoles) arrivent avec la gestion
 *   des organisateurs — d'ici là, il a tous les droits sauf la suppression ;
 * - un ADMINISTRATEUR global peut tout.
 */
export interface DroitsEvenement {
  /** Voir l'événement et sa gestion. */
  voir: boolean
  /** Modifier ses informations (nom, lieu, dates, fuseau…). */
  modifier: boolean
  /** Le supprimer, avec toutes ses données. */
  supprimer: boolean
  estProprietaire: boolean
}

const AUCUN: DroitsEvenement = {
  voir: false,
  modifier: false,
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
      select: { id: true },
    }),
  ])
  if (!evenement) return AUCUN
  const estProprietaire = evenement.ownerId === userId
  const estAdmin = !!utilisateur?.isGlobalAdmin
  const estOrganisateur = !!organisateur
  return {
    voir: estProprietaire || estAdmin || estOrganisateur,
    modifier: estProprietaire || estAdmin || estOrganisateur,
    supprimer: estProprietaire || estAdmin,
    estProprietaire,
  }
}

/** L'identifiant de l'événement dans l'URL, validé. */
export function idEvenement(event: Parameters<typeof getRouterParam>[0]): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ status: 400, message: 'Identifiant invalide' })
  return id
}
