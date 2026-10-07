import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { dateDuRemboursement } from '#server/utils/treasury-guards'
import { validateEditionId } from '#server/utils/validation-helpers'
import { cleDuNomAvance } from '~~/shared/utils/avance-nom-libre'

const bodySchema = z
  .object({
    advancedById: z.number().int().positive().optional(),
    /** La même action pour une personne sans compte, désignée par le nom saisi sur les lignes. */
    advancedByName: z.string().min(1).max(150).optional(),
  })
  .refine((corps) => !!corps.advancedById !== !!corps.advancedByName, {
    message: 'Indiquer un compte OU un nom libre, pas les deux',
  })

/**
 * POST /api/editions/:id/treasury/entries/reimburse — solde toutes les avances d'une personne.
 *
 * Rembourser se fait en un versement : pointer les lignes une par une était le geste le plus
 * fastidieux de la page, et le plus facile à laisser à moitié fait.
 *
 * Le lot mis à jour est EXACTEMENT celui que totalise la carte « À rembourser » — dépenses de
 * cette personne, non remboursées, non prévisionnelles. Marquer une avance prévisionnelle serait
 * incohérent : elle n'entrait pas dans le montant qu'on vient de verser, puisque rien n'était
 * encore sorti de la poche de personne.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const { advancedById, advancedByName } = bodySchema.parse(await readBody(event))

    const communes = {
      editionId,
      kind: 'EXPENSE' as const,
      reimbursed: false,
      isForecast: false,
    }

    /*
     * Toujours une BASCULE ici : le filtre `communes` ne retient que `reimbursed: false`. La règle
     * est appelée quand même, pour que la date vienne du même endroit que sur les deux autres
     * points d'écriture — recopiée, elle finirait par ne plus dire la même chose ici.
     */
    const dateDuVersement = dateDuRemboursement(false, true)

    if (advancedById) {
      const { count } = await prisma.treasuryEntry.updateMany({
        where: { ...communes, advancedById },
        data: { reimbursed: true, ...dateDuVersement },
      })
      return createSuccessResponse({ count })
    }

    /*
     * Un nom libre ne se retrouve pas par égalité de chaîne : le panneau regroupe « Jean-Luc » et
     * « jean-luc » sur une seule dette, et verser la somme doit solder les deux. La comparaison
     * passe donc par `cleDuNomAvance`, le MÊME normaliseur que l'agrégat — s'en remettre à la
     * collation de MySQL marcherait pour la casse et les accents, mais pas pour les espaces, et
     * laisserait des lignes ouvertes après un versement déjà fait.
     */
    const cleVisee = cleDuNomAvance(advancedByName)
    const candidates = await prisma.treasuryEntry.findMany({
      where: { ...communes, advancedById: null, NOT: { advancedByName: null } },
      select: { id: true, advancedByName: true },
    })
    const ids = candidates
      .filter((entry) => cleDuNomAvance(entry.advancedByName) === cleVisee)
      .map((entry) => entry.id)

    if (ids.length === 0) return createSuccessResponse({ count: 0 })

    const { count } = await prisma.treasuryEntry.updateMany({
      where: { id: { in: ids }, ...communes },
      data: { reimbursed: true, ...dateDuVersement },
    })

    return createSuccessResponse({ count })
  },
  { operationName: 'ReimburseTreasuryAdvances' }
)
