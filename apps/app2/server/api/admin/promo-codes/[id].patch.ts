import { z } from 'zod'

import { exigerAdministrateur } from '../../../utils/administration'

/**
 * Modifier un code promo : l'activer ou le désactiver, et ce qui ne change pas l'avantage déjà
 * accordé (note, fin de validité, plafond). L'avantage lui-même ne se modifie pas : ceux qui ont
 * utilisé le code l'ont accepté tel quel. Pour un autre avantage, on crée un autre code.
 */
const schema = z
  .object({
    active: z.boolean().optional(),
    label: z.string().trim().max(191).optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    maxRedemptions: z.number().int().min(1).optional().nullable(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const id = Number(getRouterParam(event, 'id'))
  const resultat = schema.safeParse(await readBody(event))
  if (!Number.isInteger(id) || !resultat.success) {
    throw createError({ status: 400, message: 'Données invalides' })
  }
  const existe = await prisma.promoCode.findUnique({ where: { id }, select: { id: true } })
  if (!existe) throw createError({ status: 404, message: 'Code introuvable' })
  const code = await prisma.promoCode.update({ where: { id }, data: resultat.data })
  return createSuccessResponse({ code }, 'Code mis à jour')
})
