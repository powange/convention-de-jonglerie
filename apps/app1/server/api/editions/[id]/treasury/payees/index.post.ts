import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  coordonneesBancairesDuBeneficiaire,
  listerBeneficiaires,
  MAX_BENEFICIAIRES_PAR_EDITION,
} from '#server/utils/treasury-payees'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * `trim()` AVANT `min(1)`, comme pour les codes d'imputation : zod applique les transformations
 * dans l'ordre déclaré, et un libellé fait d'espaces passerait sinon la validation pour
 * s'enregistrer vide.
 */
const bodySchema = z.object({
  label: z.string().trim().min(1).max(150),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

/**
 * Crée un bénéficiaire dans le carnet d'une édition.
 *
 * ⚠️ L'IBAN et le BIC sont NORMALISÉS avant écriture (majuscules, sans espaces). C'est ce qui
 * permettra au regroupement des versements de reconnaître deux saisies du même compte : sans cela,
 * « FR76 1234 » et « fr7612 34 » produiraient deux virements au lieu d'un.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const data = bodySchema.parse(await readBody(event))

    // Deux bénéficiaires du même nom sont presque toujours un doublon de saisie, et ils rendraient
    // la carte des versements illisible. La contrainte d'unicité tranche en base ; ce contrôle
    // donne un message compréhensible plutôt qu'une erreur brute.
    const existant = await prisma.treasuryPayee.findFirst({
      where: { editionId, label: data.label },
      select: { id: true },
    })
    if (existant) {
      throw createError({ status: 400, message: 'Ce bénéficiaire existe déjà pour cette édition' })
    }

    const nombre = await prisma.treasuryPayee.count({ where: { editionId } })
    if (nombre >= MAX_BENEFICIAIRES_PAR_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${MAX_BENEFICIAIRES_PAR_EDITION} bénéficiaires atteinte pour cette édition`,
      })
    }

    await prisma.treasuryPayee.create({
      data: {
        editionId,
        label: data.label,
        notes: data.notes || null,
        ...coordonneesBancairesDuBeneficiaire(data),
      },
    })

    // La liste complète suit la création : l'écran la remplace d'un bloc plutôt que d'insérer à la
    // main, ce qui le dispense de reproduire l'ordre de tri du serveur — et de s'en écarter.
    return createSuccessResponse({ payees: await listerBeneficiaires(editionId) })
  },
  { operationName: 'CreateTreasuryPayee' }
)
