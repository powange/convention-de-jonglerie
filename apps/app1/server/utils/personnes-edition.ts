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

/**
 * Vérifie que les responsables désignés sont bien des gens de cette édition.
 *
 * Sans ce contrôle, le champ acceptait n'importe quel identifiant de compte, et la fiche renvoyait
 * ensuite le pseudo, le nom et l'avatar de la personne : de quoi parcourir l'annuaire des comptes
 * en balayant les identifiants. Créer sa propre convention suffit à obtenir le droit de le faire,
 * ce qui mettait ce parcours à la portée de tout inscrit.
 *
 * C'était la seule référence du module qui n'était pas confrontée à l'édition — les tags, les
 * zones, les marqueurs et le groupe de destination l'étaient déjà.
 */
export async function assertResponsablesDeLEdition(
  editionId: number,
  conventionId: number,
  responsableIds: Array<number | null | undefined>
): Promise<void> {
  const ids = Array.from(
    new Set(responsableIds.filter((id): id is number => typeof id === 'number'))
  )
  if (ids.length === 0) return

  const trouves = await prisma.user.findMany({
    where: { id: { in: ids }, OR: attachesALEdition(editionId, conventionId) },
    select: { id: true },
  })
  if (trouves.length !== ids.length) {
    throw createError({
      status: 400,
      message: "Cette personne ne fait pas partie de l'édition",
    })
  }
}
