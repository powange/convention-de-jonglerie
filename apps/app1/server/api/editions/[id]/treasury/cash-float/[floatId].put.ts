import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { dateDeSolde, preteurNormalise } from '#server/utils/treasury-guards'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

const bodySchema = z.object({
  amount: z.number().positive().max(10_000_000),
  lentById: z.number().int().positive().nullable().optional(),
  lentByName: z.string().max(150).nullable().optional(),
  operationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().max(300).nullable().optional(),
  restituted: z.boolean().optional(),
})

const dateDApport = (valeur: string | null | undefined): Date | null =>
  valeur ? new Date(`${valeur}T00:00:00.000Z`) : null

/** PUT /api/editions/:id/treasury/cash-float/:floatId — corrige un apport ou le marque restitué. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const floatId = Number(getRouterParam(event, 'floatId'))
    if (!Number.isInteger(floatId) || floatId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’apport invalide' })
    }

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const data = bodySchema.parse(await readBody(event))

    /*
     * ⚠️ L'APPORT DOIT APPARTENIR À CETTE ÉDITION. Le droit est vérifié sur l'édition de l'URL :
     * sans ce contrôle, quelqu'un qui gère la trésorerie d'une édition pourrait modifier l'apport
     * d'une autre en passant son identifiant. Le `where` composite ci-dessous le rend impossible.
     *
     * 📍 On lit l'état d'AVANT dans le même mouvement : la règle de datation en a besoin pour ne
     * pas déplacer la date d'une restitution déjà faite.
     */
    const avant = await prisma.treasuryCashFloat.findFirst({
      where: { id: floatId, editionId },
      select: { id: true, restitutedAt: true },
    })
    if (!avant) {
      throw createError({ status: 404, message: 'Apport introuvable' })
    }

    const date = dateDeSolde(avant.restitutedAt != null, data.restituted ?? false)

    await prisma.treasuryCashFloat.update({
      where: { id: avant.id },
      data: {
        amount: toCents(data.amount)!,
        ...preteurNormalise(data),
        operationDate: dateDApport(data.operationDate),
        note: data.note ?? null,
        // `undefined` veut dire « ne touche pas à la date » : voir `dateDeSolde`.
        ...(date === undefined ? {} : { restitutedAt: date }),
      },
    })

    return createSuccessResponse({ id: avant.id })
  },
  { operationName: 'UpdateTreasuryCashFloat' }
)
