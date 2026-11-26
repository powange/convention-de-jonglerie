import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  coordonneesBancairesDuBeneficiaire,
  listerBeneficiaires,
} from '#server/utils/treasury-payees'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  label: z.string().trim().min(1).max(150).optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

/**
 * Modifie un bénéficiaire du carnet.
 *
 * ⚠️ La mise à jour est adressée par `{ id, editionId }` et non par `id` seul. Sans l'édition dans
 * le `where`, un organisateur habilité sur UNE édition pourrait modifier le bénéficiaire d'une
 * AUTRE en changeant l'identifiant dans l'URL : la garde ci-dessus ne vérifie que ses droits sur
 * l'édition du chemin, pas l'appartenance de la ligne visée. Sur des coordonnées bancaires, le
 * détournement serait coûteux.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const payeeId = Number(getRouterParam(event, 'payeeId'))
    if (!Number.isInteger(payeeId) || payeeId <= 0) {
      throw createError({ status: 400, message: 'Identifiant de bénéficiaire invalide' })
    }

    const data = bodySchema.parse(await readBody(event))

    // Renommer vers un libellé déjà pris recréerait le doublon que l'unicité empêche. Contrôlé ici
    // pour un message lisible, et tranché en base de toute façon.
    if (data.label) {
      const homonyme = await prisma.treasuryPayee.findFirst({
        where: { editionId, label: data.label, NOT: { id: payeeId } },
        select: { id: true },
      })
      if (homonyme) {
        throw createError({
          status: 400,
          message: 'Ce bénéficiaire existe déjà pour cette édition',
        })
      }
    }

    const resultat = await prisma.treasuryPayee.updateMany({
      where: { id: payeeId, editionId },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...coordonneesBancairesDuBeneficiaire(data),
      },
    })

    // `updateMany` ne lève pas sur une ligne absente : il rend 0. Sans ce contrôle, viser le
    // bénéficiaire d'une autre édition répondrait 200 en n'ayant rien fait — un succès mensonger.
    if (resultat.count === 0) {
      throw createError({ status: 404, message: 'Bénéficiaire introuvable pour cette édition' })
    }

    return createSuccessResponse({ payees: await listerBeneficiaires(editionId) })
  },
  { operationName: 'UpdateTreasuryPayee' }
)
