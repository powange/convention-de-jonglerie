import { requireUserSession } from '#imports'

import { resumeAvantage } from '../../../shared/codes-promo'
import prisma from '../../utils/prisma'
import { couvertureDe, isSubscriptionActive } from '../../utils/subscription'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    include: { promoCode: true },
  })
  const code = subscription?.promoCode

  const couverture = couvertureDe(subscription)
  return {
    active: isSubscriptionActive(subscription),
    // La formule qui s'applique (« decouverte » sans abonnement payant actif) et ses plafonds.
    formule: couverture.formule,
    plafonds: couverture.plafonds,
    subscription: subscription
      ? {
          plan: subscription.plan,
          formule: subscription.formule,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          amountPaid: subscription.amountPaid,
          // Le code de l'abonnement : la page tarifs prévient si une autre formule le ferait perdre.
          codePromo: code
            ? {
                code: code.code,
                resume: resumeAvantage(code),
                formules: code.formules as string[] | null,
                periods: code.periods as string[] | null,
                duration: code.duration,
                advantageEndsAt: subscription.advantageEndsAt,
              }
            : null,
        }
      : null,
  }
})
