import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { dateDeSolde, preteurNormalise } from '#server/utils/treasury-guards'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

/**
 * La date de l'apport en `AAAA-MM-JJ`, telle que Prisma l'attend.
 *
 * Une date CIVILE, comme `TreasuryEntry.operationDate` : le `Z` est explicite pour qu'élargir un
 * jour le format accepté ne fasse pas basculer l'interprétation en heure locale, ce qui décalerait
 * le jour à l'ouest de Greenwich.
 */
const dateDApport = (valeur: string | null | undefined): Date | null =>
  valeur ? new Date(`${valeur}T00:00:00.000Z`) : null

const bodySchema = z.object({
  /** En unité courante, comme partout dans les formulaires, et strictement positif : un apport de
   *  zéro ne prête rien et viendrait seulement encombrer la liste. */
  amount: z.number().positive().max(10_000_000),
  lentById: z.number().int().positive().nullable().optional(),
  lentByName: z.string().max(150).nullable().optional(),
  operationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().max(300).nullable().optional(),
  /** Un apport déjà rendu, saisi après coup. Daté du jour de la saisie — on n'invente rien. */
  restituted: z.boolean().optional(),
})

/** POST /api/editions/:id/treasury/cash-float — enregistre un apport au fonds de caisse. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const data = bodySchema.parse(await readBody(event))

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const apport = await prisma.treasuryCashFloat.create({
      data: {
        editionId,
        amount: toCents(data.amount)!,
        ...preteurNormalise(data),
        operationDate: dateDApport(data.operationDate),
        // Pas d'état d'avant à la création : il n'y a aucune date à préserver.
        restitutedAt: dateDeSolde(undefined, data.restituted ?? false) ?? null,
        note: data.note ?? null,
      },
      select: { id: true },
    })

    return createSuccessResponse({ id: apport.id })
  },
  { operationName: 'CreateTreasuryCashFloat' }
)
