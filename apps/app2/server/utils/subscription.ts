import { createError, type H3Event } from 'h3'

import prisma from './prisma'

// Valeurs de plan valides, centralisées ici et validées côté serveur (String plutôt qu'enum).
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

/**
 * Garde SERVEUR : lève une 402 si l'utilisateur n'a pas d'abonnement actif.
 * À appeler dans tout futur endpoint de fonctionnalité payante (ex. gestion des bénévoles).
 * Le middleware de route `subscription` ne protège que la navigation ; l'enforcement réel
 * des données passe par cette garde côté API.
 */
export async function requireActiveSubscription(_event: H3Event, userId: number) {
  const subscription = await getActiveSubscription(userId)
  if (!subscription) {
    throw createError({ statusCode: 402, statusMessage: 'Abonnement requis' })
  }
  return subscription
}
