import { requireUserSession } from '#imports'

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
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
  }
})
