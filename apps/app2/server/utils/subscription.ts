import { createError, type H3Event } from 'h3'

import prisma from './prisma'

// SQLite ne supporte pas les enums Prisma : on centralise ici les valeurs valides.
export const SUBSCRIPTION_PLANS = ['monthly', 'annual'] as const
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

type SubscriptionLike = { status: string; currentPeriodEnd: Date } | null | undefined

/** Un abonnement est actif s'il est marqué "active" et que la période n'est pas expirée. */
export function isSubscriptionActive(subscription: SubscriptionLike): boolean {
  if (!subscription) return false
  return subscription.status === 'active' && subscription.currentPeriodEnd.getTime() > Date.now()
}

/** Renvoie l'abonnement de l'utilisateur s'il est actif, sinon null. */
export async function getActiveSubscription(userId: number) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } })
  return isSubscriptionActive(subscription) ? subscription : null
}

/** Garde serveur : lève une 402 si l'utilisateur n'a pas d'abonnement actif. */
export async function requireActiveSubscription(_event: H3Event, userId: number) {
  const subscription = await getActiveSubscription(userId)
  if (!subscription) {
    throw createError({ statusCode: 402, statusMessage: 'Abonnement requis' })
  }
  return subscription
}
