/**
 * Qui compte comme « quelqu'un de l'édition ».
 *
 * La recherche d'une personne se faisait jusqu'ici par adresse e-mail exacte, et c'était délibéré :
 * on ne parcourt pas l'annuaire des comptes, on désigne quelqu'un qu'on connaît déjà. Chercher par
 * pseudo dans tout le site reviendrait à ouvrir cet annuaire — pseudo et adresse — à qui gère un
 * stock. Le périmètre est donc celui de l'édition : les gens qui la font.
 *
 * Sorti du gestionnaire pour être éprouvé seul. C'est une règle de confidentialité : elle ne doit
 * pas dépendre d'une session d'organisateur qu'un test ne peut pas obtenir.
 */

import type { Prisma } from '#server/types/prisma'

/** Le nombre de personnes proposées. Au-delà, on affine sa recherche plutôt qu'on ne déroule. */
export const LIMITE_RESULTATS = 20

/**
 * Le filtre Prisma des comptes rattachés à une édition.
 *
 * Quatre attaches, parce qu'aucune seule ne suffit : l'auteur de la convention et le créateur de
 * l'édition ne figurent pas toujours dans la liste des organisateurs, et un bénévole n'y figure
 * jamais. Un bénévole n'est retenu qu'une fois sa candidature acceptée — proposer les candidatures
 * en attente reviendrait à confier du matériel à quelqu'un dont la venue n'est pas décidée.
 */
export function attachesALEdition(
  editionId: number,
  conventionId: number
): Prisma.UserWhereInput['OR'] {
  return [
    { organizations: { some: { conventionId } } },
    { volunteerApplications: { some: { eventId: editionId, status: 'ACCEPTED' } } },
    { createdEditions: { some: { id: editionId } } },
    { createdConventions: { some: { id: conventionId } } },
  ]
}
