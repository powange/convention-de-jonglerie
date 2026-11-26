import { requireUserSession } from '#imports'

import { resumeAvantage } from '../../../shared/codes-promo'
import { modulesCouverts } from '../../../shared/formules'
import prisma from '../../utils/prisma'
import { isSubscriptionActive } from '../../utils/subscription'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    include: { promoCode: true },
  })
  const code = subscription?.promoCode

  return {
    active: isSubscriptionActive(subscription),
    subscription: subscription
      ? {
          plan: subscription.plan,
          formule: subscription.formule,
          modules: modulesCouverts(subscription.formule, subscription.modules),
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
