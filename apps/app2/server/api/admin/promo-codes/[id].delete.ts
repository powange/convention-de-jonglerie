import { exigerAdministrateur } from '../../../utils/administration'

/**
 * Supprimer un code promo JAMAIS utilisé (une faute de frappe à la création). Un code utilisé ne se
 * supprime pas : on le désactive, et ses bénéficiaires gardent leur avantage jusqu'à son terme.
 */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ status: 404, message: 'Code introuvable' })
  const code = await prisma.promoCode.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  })
  if (!code) throw createError({ status: 404, message: 'Code introuvable' })
  if (code._count.redemptions > 0) {
    throw createError({
      status: 409,
      message: 'Ce code a déjà été utilisé : désactivez-le plutôt que de le supprimer',
    })
  }
  await prisma.promoCode.delete({ where: { id } })
  return createSuccessResponse(null, 'Code supprimé')
})
