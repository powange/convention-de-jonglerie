import { requireUserSession } from '#imports'

import { modulesCouverts } from '../../../shared/formules'
import prisma from '../../utils/prisma'
import { isSubscriptionActive } from '../../utils/subscription'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })

  return {
    active: isSubscriptionActive(subscription),
    subscription: subscription
      ? {
          plan: subscription.plan,
          formule: subscription.formule,
          modules: modulesCouverts(subscription.formule, subscription.modules),
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
  }
})
