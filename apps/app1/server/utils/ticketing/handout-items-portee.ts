/**
 * Refuse des articles qui n'appartiennent pas à l'édition visée.
 *
 * Les trois points d'API de remplacement (bénévoles, artistes, organisateurs) reçoivent une liste
 * d'identifiants d'articles depuis le client. Sans ce contrôle, un identifiant emprunté à une
 * autre édition s'y associerait sans rien signaler : les tables de liaison ne portent pas de
 * contrainte croisée entre `editionId` et l'édition de l'article.
 *
 * Écrit en un seul endroit plutôt que recopié trois fois — c'est exactement la forme du contrôle
 * que les quotas tiennent dans `assertQuotasDeLEdition`, et la leçon qui revient dans ce module
 * est qu'une règle recopiée l'est toujours plus de fois qu'annoncé.
 */
export async function exigerDesArticlesDeLEdition(
  editionId: number,
  handoutItemIds: number[]
): Promise<void> {
  if (handoutItemIds.length === 0) return

  const uniques = Array.from(new Set(handoutItemIds))
  const trouves = await prisma.ticketingHandoutItem.count({
    where: { id: { in: uniques }, editionId },
  })

  if (trouves !== uniques.length) {
    throw createError({
      status: 400,
      message: "Certains articles n'appartiennent pas à cette édition",
    })
  }
}
