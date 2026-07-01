import { z } from 'zod'

import { requireUserSession } from '#imports'

import prisma from '../../utils/prisma'
import { SUBSCRIPTION_PLANS } from '../../utils/subscription'

const checkoutSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { plan } = checkoutSchema.parse(await readBody(event))

  // ⚠️ Paiement SIMULÉ : aucun prestataire de paiement réel n'est appelé.
  // On considère le paiement réussi et on active immédiatement l'abonnement.
  const currentPeriodEnd = new Date()
  if (plan === 'monthly') {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)
  } else {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, plan, status: 'active', currentPeriodEnd },
    update: { plan, status: 'active', currentPeriodEnd },
  })

  return {
    success: true,
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  }
})
