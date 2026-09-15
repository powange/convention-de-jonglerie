/**
 * L'écriture des quotas des personnes présentes sans billet — la seule.
 *
 * Six endpoints y mènent : pour chacune des trois familles (organisateurs, bénévoles, artistes),
 * celui de la ligne GLOBALE et celui d'une cible nommée. Ils ne diffèrent que par la table de
 * liaison et par la colonne qui porte la cible. Tout le reste — vérifier que les quotas sont bien
 * ceux de l'édition, dédoublonner, effacer, recréer — est identique.
 *
 * C'est précisément le genre de logique qu'on recopie « juste une fois », et qui se met à diverger
 * au premier correctif appliqué d'un seul côté. Elle vit donc ici, une fois.
 */

/** Une table de liaison quota ↔ personnes, vue au travers de la transaction. */
interface TableDeLiaison {
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>
  createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>
}

export interface RemplacementDeQuotas {
  editionId: number
  quotaIds: number[]
  /** La table à réécrire, prise sur la transaction en cours. */
  table: (tx: any) => TableDeLiaison
  /**
   * La cible, sous la forme de sa colonne : `{ organizerId }`, `{ teamId }` ou `{ showId }`.
   * Une valeur nulle y désigne la ligne globale — tous les organisateurs, tous les bénévoles,
   * tous les artistes.
   */
  cible: Record<string, number | string | null>
}

export async function remplacerLesQuotas({
  editionId,
  quotaIds,
  table,
  cible,
}: RemplacementDeQuotas): Promise<number[]> {
  // Un même quota envoyé deux fois violerait l'unicité (édition, quota, cible) : on déduplique
  // plutôt que de laisser la base refuser une saisie qui n'a rien d'aberrant à l'écran.
  const ids = [...new Set(quotaIds)]

  // Les quotas doivent appartenir à cette édition — sans quoi on rattacherait des personnes à la
  // jauge d'une autre convention.
  if (ids.length > 0) {
    const nombre = await prisma.ticketingQuota.count({
      where: { id: { in: ids }, editionId },
    })
    if (nombre !== ids.length) {
      throw createError({
        status: 400,
        message: "Certains quotas n'appartiennent pas à cette édition",
      })
    }
  }

  await prisma.$transaction(async (tx) => {
    /**
     * Effacer puis recréer, ce qui fait de l'appel un remplacement complet.
     *
     * Ce n'est pas seulement une commodité : sous MySQL, deux NULL sont distincts dans un index
     * unique, donc la contrainte `@@unique` ne protège PAS la ligne globale contre les doublons.
     * Un simple `createMany` finirait par en empiler. La suppression préalable est ce qui tient
     * réellement l'unicité de ce côté-là.
     *
     * La cible est dans le `where` : sans elle, réécrire la ligne globale emporterait aussi les
     * associations propres à chaque équipe, organisateur ou spectacle.
     */
    await table(tx).deleteMany({ where: { editionId, ...cible } })
    if (ids.length > 0) {
      await table(tx).createMany({
        data: ids.map((quotaId) => ({ editionId, quotaId, ...cible })),
      })
    }
  })

  return ids
}
