/**
 * Qui peut quoi sur un événement Flowvent — la règle écrite une fois.
 *
 * - le PROPRIÉTAIRE (créateur) peut tout, et lui seul (avec un administrateur) supprime ;
 * - un ORGANISATEUR déclaré (`EditionOrganizer`) voit la gestion, et a les droits par domaine
 *   qu'on lui a donnés (la liste : `DROITS_PAR_DOMAINE`, shared/modules-evenement.ts) ;
 * - un ADMINISTRATEUR global peut tout.
 *
 * Abonnement (décision de l'utilisateur) : c'est celui du PROPRIÉTAIRE qui ouvre la gestion de
 * l'événement, à lui comme à ses organisateurs ; un organisateur n'a pas besoin du sien.
 */
import type { ColonneDroit, ColonneModule, Droits, Modules } from '../../shared/modules-evenement'

import { DROITS_PAR_DOMAINE, MODULES_EVENEMENT } from '../../shared/modules-evenement'
import { getActiveSubscription } from './subscription'

export type DroitsEvenement = Droits & {
  /** Voir l'événement et sa gestion. */
  voir: boolean
  /** Le supprimer, avec toutes ses données. */
  supprimer: boolean
  estProprietaire: boolean
}

/** Les colonnes d'activation de tous les modules, pour un `select` Prisma. */
export const selectionModules = Object.fromEntries(
  MODULES_EVENEMENT.map((m) => [m.colonne, true])
) as Record<ColonneModule, true>

/** Les modules actifs, dans le vocabulaire de l'API (`{ benevoles: true, stock: false… }`). */
export function modulesAffiches(e: Record<ColonneModule, boolean>): Modules {
  return Object.fromEntries(MODULES_EVENEMENT.map((m) => [m.cle, e[m.colonne]])) as Modules
}

/** Les colonnes de tous les droits par domaine, pour un `select` Prisma. */
export const selectionDroits = Object.fromEntries(
  DROITS_PAR_DOMAINE.map((d) => [d.colonne, true])
) as Record<ColonneDroit, true>

const AUCUN = {
  ...(Object.fromEntries(DROITS_PAR_DOMAINE.map((d) => [d.cle, false])) as Droits),
  voir: false,
  supprimer: false,
  estProprietaire: false,
} satisfies DroitsEvenement

export async function droitsSurEvenement(
  eventId: number,
  userId: number
): Promise<DroitsEvenement> {
  const [evenement, utilisateur, organisateur] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } }),
    prisma.editionOrganizer.findFirst({
      where: { editionId: eventId, organizer: { userId } },
      select: selectionDroits,
    }),
  ])
  if (!evenement) return AUCUN
  const estProprietaire = evenement.ownerId === userId
  const tout = estProprietaire || !!utilisateur?.isGlobalAdmin
  const parDomaine = Object.fromEntries(
    DROITS_PAR_DOMAINE.map((d) => [d.cle, tout || !!organisateur?.[d.colonne]])
  ) as Droits
  return {
    ...parDomaine,
    voir: tout || !!organisateur,
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
