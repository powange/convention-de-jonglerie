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
