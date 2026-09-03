import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { assertCodeBelongsToEdition, avanceNormalisee } from '#server/utils/treasury-guards'
import { deplacerJustificatif, supprimerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

const bodySchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']).optional(),
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  codeId: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  isForecast: z.boolean().optional(),
  advancedById: z.number().int().positive().nullable().optional(),
  reimbursed: z.boolean().optional(),
})

/** PUT /api/editions/:id/treasury/entries/:entryId — modifie une ligne saisie à la main. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const entryId = validateResourceId(event, 'entryId', 'ligne')

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    // Le filtre sur `editionId` évite qu'une ligne appartenant à une autre édition ne soit
    // modifiée depuis celle-ci : le droit est vérifié sur l'édition de l'URL, pas sur la ligne.
    const existing = await prisma.treasuryEntry.findFirst({
      where: { id: entryId, editionId },
      select: {
        id: true,
        imageUrl: true,
        kind: true,
        advancedById: true,
        reimbursed: true,
        edition: { select: { id: true, conventionId: true } },
      },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Ligne introuvable' })
    }

    const data = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, data.codeId)

    // Le justificatif change : déplacer le nouveau depuis `temp/` avant d'écrire, pour ne pas
    // enregistrer une référence vers un fichier qui n'a pas bougé.
    const nouveauJustificatif =
      data.imageUrl !== undefined
        ? await deplacerJustificatif(data.imageUrl, existing.edition)
        : undefined

    // Recalculé à partir de l'état EFFECTIF après mise à jour, et non de la seule saisie : passer
    // une dépense en recette doit effacer l'avance, même si le client ne l'a pas renvoyée.
    const avance = avanceNormalisee({
      kind: data.kind ?? existing.kind,
      advancedById: data.advancedById !== undefined ? data.advancedById : existing.advancedById,
      reimbursed: data.reimbursed !== undefined ? data.reimbursed : existing.reimbursed,
    })

    await prisma.treasuryEntry.update({
      where: { id: entryId },
      data: {
        ...(data.kind !== undefined && { kind: data.kind }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: toCents(data.amount)! }),
        ...(data.codeId !== undefined && { codeId: data.codeId }),
        // `null` explicite = justificatif retiré ; absent = laissé tel quel.
        ...(nouveauJustificatif !== undefined && { imageUrl: nouveauJustificatif }),
        ...(data.isForecast !== undefined && { isForecast: data.isForecast }),
        ...avance,
      },
    })

    // L'ancien justificatif ne part qu'une fois la base à jour, et seulement s'il a vraiment
    // changé : réenregistrer une entrée sans toucher à sa photo ne doit rien effacer.
    if (
      nouveauJustificatif !== undefined &&
      existing.imageUrl &&
      nouveauJustificatif !== existing.imageUrl
    ) {
      await supprimerJustificatif(existing.imageUrl, existing.edition)
    }

    return createSuccessResponse({ updated: entryId })
  },
  { operationName: 'UpdateTreasuryEntry' }
)
