import type { PrismaTransaction } from '#server/types/prisma-helpers'

/**
 * Les organisateurs habilités sur les artistes d'une édition.
 *
 * ## ⚠️ POURQUOI CETTE FONCTION A QUITTÉ `messenger-helpers.ts`
 *
 * La question « qui gère les artistes de cette édition ? » recevait **deux réponses** dans le
 * dépôt :
 *
 * | | ici (ex-`messenger-helpers`) | écrit en ligne dans `applications/index.post.ts` |
 * | --- | --- | --- |
 * | auteur de la convention | oui | oui |
 * | organisateurs `canManageArtists` | oui | oui |
 * | droits par édition | oui | oui |
 * | **créateur de l'édition** | **oui** | **NON** |
 *
 * Conséquence mesurable : l'organisateur qui a CRÉÉ une édition sans détenir `canManageArtists`
 * était **inscrit à la conversation** d'une candidature mais **pas notifié** de son dépôt. Il
 * recevait les messages sans jamais savoir qu'une candidature était arrivée.
 *
 * C'est le défaut déjà payé sur le bénévolat, où l'auteur d'une convention reçoit six droits à la
 * création et où `canManageVolunteers` n'en fait pas partie : deux énumérations d'un même ensemble
 * finissent toujours par diverger. Il n'y en a plus qu'une.
 *
 * 📍 Le créateur de l'édition y est à sa place : c'est lui qui l'a ouverte, et le dépôt le
 * reconnaît déjà comme décideur ailleurs (`getEditionForEdit`, la conversation d'une candidature).
 */
export async function organisateursHabilitesSurLesArtistes(
  editionId: number,
  client: PrismaTransaction | typeof prisma = prisma
): Promise<number[]> {
  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: {
      creatorId: true,
      convention: {
        select: {
          authorId: true,
          organizers: { where: { canManageArtists: true }, select: { userId: true } },
        },
      },
      organizerPermissions: {
        where: { canManageArtists: true },
        select: { organizer: { select: { userId: true } } },
      },
    },
  })

  if (!edition) {
    throw new Error('Édition introuvable')
  }

  /*
   * ⚠️ `creatorId` est NULLABLE : une édition importée n'a pas de créateur, et le `Set` garderait
   * alors un `null` qu'on notifierait comme un identifiant. Le filtre est explicite.
   */
  return [
    ...new Set<number>(
      [
        edition.creatorId,
        edition.convention.authorId,
        ...edition.convention.organizers.map((o) => o.userId),
        ...edition.organizerPermissions.map((p) => p.organizer.userId),
      ].filter((id): id is number => typeof id === 'number')
    ),
  ]
}
