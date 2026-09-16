/**
 * « Ces quotas sont-ils bien ceux de cette édition ? » — écrit une fois.
 *
 * La question se posait de trois façons dans le module, avec trois réponses différentes pour la
 * même faute : un `findUnique` suivi d'une comparaison manuelle rendant 403, un filtre `editionId`
 * glissé dans la requête dont l'absence de correspondance finissait en 500, et un `count` comparé
 * à la longueur attendue rendant 400.
 *
 * ## Pourquoi 400, et pas 403 ni 404
 *
 * C'est l'idiome déjà établi ailleurs dans le dépôt — `assertTagsBelongToEdition` pour le stock,
 * `assertCodeBelongsToEdition` pour la trésorerie — avec le même message.
 *
 * Et c'est le bon choix pour une autre raison : distinguer « introuvable » (404) de « appartient à
 * une autre édition » (403) apprend à qui sonde quels identifiants existent. Une seule réponse
 * pour les deux cas ne dit rien de plus que « pas ici ».
 */
export async function assertQuotasDeLEdition(editionId: number, quotaIds: number[]): Promise<void> {
  if (quotaIds.length === 0) return

  const uniques = Array.from(new Set(quotaIds))
  const trouves = await prisma.ticketingQuota.findMany({
    where: { id: { in: uniques }, editionId },
    select: { id: true },
  })

  if (trouves.length !== uniques.length) {
    throw createError({
      status: 400,
      message: "Certains quotas n'appartiennent pas à cette édition",
    })
  }
}
