import type { Prisma } from '#server/types/prisma'

type ClientPrisma = Prisma.TransactionClient | typeof prisma

/**
 * Combien de tâches de cette édition me sont assignées ?
 *
 * Sert à décider si l'onglet « Mes tâches » doit s'afficher : un onglet qui mène à une page vide
 * envoie chercher une fonctionnalité qu'on n'a pas.
 *
 * ⚠️ `group` ET NON `taskGroup`. La relation de `Task` vers son groupe porte ce nom, alors que sa
 * clé étrangère s'appelle `taskGroupId` — et c'est précisément l'écart qui m'a fait écrire le
 * mauvais chemin. Prisma refuse à L'EXÉCUTION (« Unknown argument taskGroup »), ce qui a produit
 * un **500 sur `/api/editions/[id]`** en production : la page d'édition entière était cassée pour
 * tout visiteur connecté d'une édition où le module des tâches est actif.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE, plutôt que la requête écrite dans le point d'API. Un test à
 * bouchon ne peut PAS attraper ce défaut : il compare l'appel à la forme qu'on a soi-même écrite,
 * et un bouchon accepte n'importe quel objet. Seule une requête qui atteint vraiment Prisma le
 * voit. En la sortant ici, le test d'intégration exerce **la même** requête que la production, au
 * lieu d'une copie qui pourrait en diverger.
 *
 * 📍 Un `count` et non la liste : l'appelant n'a besoin que de « oui ou non », et
 * `TaskAssignment.userId` est indexé.
 */
export function compterMesTachesDeLEdition(
  client: ClientPrisma,
  editionId: number,
  userId: number
): Promise<number> {
  return client.taskAssignment.count({
    where: { userId, task: { group: { editionId } } },
  })
}
