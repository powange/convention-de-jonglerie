import { nomAvanceAEnregistrer } from '~~/shared/utils/avance-nom-libre'

/**
 * Vérifie qu'un code d'imputation appartient bien à la convention de l'édition.
 *
 * Les codes sont portés par la convention, les lignes par l'édition : rien dans le schéma
 * n'empêche donc de rattacher le code d'une autre convention. Sans ce contrôle, un organisateur
 * pourrait imputer ses dépenses sur le plan comptable de quelqu'un d'autre — et le découvrirait
 * en voyant apparaître ses propres codes chez lui.
 *
 * `null` et `undefined` sont acceptés : une ligne sans imputation est légitime.
 */
export async function assertCodeBelongsToEdition(
  editionId: number,
  codeId: number | null | undefined
): Promise<void> {
  if (codeId === null || codeId === undefined) return

  const code = await prisma.treasuryCode.findFirst({
    where: { id: codeId, convention: { editions: { some: { id: editionId } } } },
    select: { id: true },
  })

  if (!code) {
    throw createError({
      status: 400,
      message: "Ce code d'imputation n'appartient pas à la convention de cette édition",
    })
  }
}

/**
 * L'avance et son remboursement n'ont de sens que sur une DÉPENSE avancée par quelqu'un.
 *
 * Normalisé plutôt que refusé : un formulaire qui bascule de dépense à recette laisse traîner les
 * champs qu'il affichait, et rejeter la saisie pour cela serait incompréhensible. Ce qui n'a pas
 * de sens est effacé, pas signalé.
 */
export function avanceNormalisee(saisie: {
  kind: 'EXPENSE' | 'INCOME'
  advancedById?: number | null
  advancedByName?: string | null
  reimbursed?: boolean
}) {
  const advancedById = saisie.kind === 'EXPENSE' ? (saisie.advancedById ?? null) : null

  /*
   * Un compte OU un nom libre, jamais les deux.
   *
   * Le compte l'emporte : il désigne une personne sans ambiguïté, là où un nom se regroupe par
   * ressemblance. Le formulaire est déjà exclusif, mais un client qui enverrait les deux doit
   * obtenir un état cohérent plutôt qu'une ligne comptant deux fois dans le panneau des avances.
   */
  const advancedByName = advancedById
    ? null
    : saisie.kind === 'EXPENSE'
      ? nomAvanceAEnregistrer(saisie.advancedByName)
      : null

  const avancePortee = !!advancedById || !!advancedByName
  return {
    advancedById,
    advancedByName,
    reimbursed: avancePortee ? (saisie.reimbursed ?? false) : false,
  }
}

/**
 * La date à écrire sur `reimbursedAt`, d'après la BASCULE du booléen.
 *
 * Trois cas, et le troisième est celui qui compte :
 *
 * - on vient de rembourser (`false` → `true`) : la date est maintenant ;
 * - on annule le remboursement (`→ false`) : la date s'efface, sans quoi elle resterait à
 *   contredire l'état ;
 * - **c'était déjà remboursé et ça l'est toujours : on ne touche à rien.** Réenregistrer une ligne
 *   pour en corriger le libellé ne doit pas déplacer la date du versement. C'est pour ce seul cas
 *   que la fonction a besoin de l'état d'AVANT, et c'est pour cela qu'elle rend parfois un objet
 *   vide plutôt qu'une valeur.
 *
 * ⚠️ NE PAS DÉDUIRE CETTE DATE DE `updatedAt`, qui bouge au moindre changement de libellé : le
 * chiffre serait faux et parfaitement plausible.
 *
 * 📍 Les avances soldées AVANT l'arrivée de cette colonne n'ont pas de date — 45 lignes à la
 * migration. C'est `reimbursed` qui dit l'état ; `reimbursedAt` ne dit que la date quand on la
 * connaît, et l'écran n'affiche le survol que s'il en a une.
 *
 * @param avant l'état en base, ou `undefined` à la création — il n'y a alors rien à préserver.
 */
export function dateDuRemboursement(
  avant: boolean | undefined,
  apres: boolean
): { reimbursedAt?: Date | null } {
  if (!apres) return { reimbursedAt: null }
  if (avant) return {}
  return { reimbursedAt: new Date() }
}

/**
 * Les tarifs qu'une ligne de trésorerie peut rattacher pour en tirer son montant.
 *
 * Trois refus, et chacun protège d'un compte faux plutôt que d'une saisie malpropre :
 *
 * **1. Un tarif d'une autre édition.** Son produit n'a rien à voir avec cette trésorerie, et le
 * réacheminement irait chercher des ventes d'ailleurs.
 *
 * **2. Un tarif déjà rattaché à une AUTRE ligne.** Son montant serait compté deux fois. La base
 * porte un index unique sur `tierId` qui l'interdit de toute façon — mais un refus explicite dit
 * *pourquoi*, là où la contrainte ne rendrait qu'une erreur de clé dupliquée.
 *
 * **3. Un rattachement sur une CHARGE.** Le produit de la billetterie est un produit : en tirer
 * une charge inverserait le signe d'un montant encaissé.
 *
 * `entryId` est l'exception attendue en modification : une ligne garde ses propres tarifs.
 */
export async function assertTarifsRattachables(
  editionId: number,
  kind: 'EXPENSE' | 'INCOME',
  tierIds: number[] | null | undefined,
  entryId?: number
): Promise<void> {
  if (!tierIds?.length) return

  if (kind !== 'INCOME') {
    throw createError({
      status: 400,
      message: 'Seul un produit peut tirer son montant de tarifs de billetterie',
    })
  }

  const tarifs = await prisma.ticketingTier.findMany({
    where: { id: { in: tierIds }, editionId },
    select: { id: true, treasuryEntries: { select: { entryId: true } } },
  })

  if (tarifs.length !== new Set(tierIds).size) {
    throw createError({
      status: 400,
      message: "Un des tarifs choisis n'appartient pas à cette édition",
    })
  }

  const pris = tarifs.filter((tarif) =>
    tarif.treasuryEntries.some((lien) => lien.entryId !== entryId)
  )
  if (pris.length) {
    throw createError({
      status: 400,
      message: 'Un des tarifs choisis est déjà rattaché à une autre ligne de trésorerie',
    })
  }
}
