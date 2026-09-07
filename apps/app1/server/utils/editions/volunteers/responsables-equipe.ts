import type { PrismaTransaction } from '#server/types/prisma-helpers'

/**
 * Les responsables d'une équipe de bénévolat, bénévoles **et** organisateurs.
 *
 * Le statut de responsable n'est pas qu'une étiquette dans cette application : plusieurs
 * endpoints l'acceptent en lieu et place du droit « gestion des bénévoles » — voir les bénévoles
 * de ses équipes, leur écrire. Il vivait jusqu'ici dans la seule table des candidatures ; un
 * organisateur nommé responsable n'en aurait donc rien obtenu.
 *
 * Ces fonctions sont le point de passage unique. Interroger `applicationTeamAssignment` seul
 * quelque part rouvrirait l'angle mort sans que rien ne le signale — c'est la raison d'être de
 * ce module plutôt que d'une clause ajoutée dans chaque requête.
 */

/**
 * Les équipes d'une édition dont l'utilisateur est responsable, à quelque titre que ce soit.
 *
 * `tx` : à passer quand l'appel vit dans une transaction, sinon la lecture manquerait les
 * lignes que celle-ci vient d'écrire.
 */
export async function equipesDontIlEstResponsable(
  eventId: number,
  userId: number,
  tx?: PrismaTransaction
): Promise<string[]> {
  const client = tx || prisma
  const [candidatures, organisateurs] = await Promise.all([
    client.applicationTeamAssignment.findMany({
      where: {
        isLeader: true,
        application: { userId, eventId, status: 'ACCEPTED' },
      },
      select: { teamId: true },
    }),
    client.organizerTeamAssignment.findMany({
      where: {
        isLeader: true,
        team: { eventId },
        editionOrganizer: { editionId: eventId, organizer: { userId } },
      },
      select: { teamId: true },
    }),
  ])

  // Une même personne peut être les deux : bénévole acceptée et organisatrice de l'édition.
  return [
    ...new Set([
      ...candidatures.map((assignation) => assignation.teamId),
      ...organisateurs.map((assignation) => assignation.teamId),
    ]),
  ]
}

/** Les identifiants des utilisateurs responsables d'une équipe donnée. */
export async function utilisateursResponsablesDeLEquipe(
  eventId: number,
  teamId: string,
  tx?: PrismaTransaction
): Promise<number[]> {
  const client = tx || prisma
  const [candidatures, organisateurs] = await Promise.all([
    client.applicationTeamAssignment.findMany({
      where: { teamId, isLeader: true, application: { eventId } },
      select: { application: { select: { userId: true } } },
    }),
    client.organizerTeamAssignment.findMany({
      where: { teamId, isLeader: true, editionOrganizer: { editionId: eventId } },
      select: { editionOrganizer: { select: { organizer: { select: { userId: true } } } } },
    }),
  ])

  return [
    ...new Set([
      ...candidatures.map((assignation) => assignation.application.userId),
      ...organisateurs.map((assignation) => assignation.editionOrganizer.organizer.userId),
    ]),
  ]
}
