import { resumeAvantage } from '../../../../shared/codes-promo'
import { exigerAdministrateur } from '../../../utils/administration'

/** Les codes promo, du plus récent au plus ancien, avec leur nombre d'utilisations. */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  })
  const maintenant = new Date()
  return {
    codes: codes.map(({ _count, ...c }) => ({
      ...c,
      resume: resumeAvantage(c),
      utilisations: _count.redemptions,
      // L'état lisible d'un coup d'œil : désactivé, expiré, épuisé, à venir, ou actif.
      etat: !c.active
        ? 'desactive'
        : c.expiresAt && c.expiresAt < maintenant
          ? 'expire'
          : c.maxRedemptions !== null && _count.redemptions >= c.maxRedemptions
            ? 'epuise'
            : c.startsAt && c.startsAt > maintenant
              ? 'a-venir'
              : 'actif',
    })),
  }
})
