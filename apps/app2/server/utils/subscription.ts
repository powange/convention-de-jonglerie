import { createError, type H3Event } from 'h3'

import { CLES_FORMULES, PERIODES, modulesCouverts } from '../../shared/formules'

import prisma from './prisma'

import type { CleFormule, ModulePayant } from '../../shared/formules'

// Valeurs valides, centralisées dans shared/formules.ts et validées côté serveur (String en base).
// `plan` porte la PÉRIODE (mensuel ou annuel) ; la formule vit dans `formule`.
export const SUBSCRIPTION_PLANS = PERIODES
export const SUBSCRIPTION_FORMULES = CLES_FORMULES
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

type SubscriptionLike = { status: string; currentPeriodEnd: Date } | null | undefined

type SubscriptionAvecFormule =
  | {
      status: string
      currentPeriodEnd: Date
      formule: string
      modules: unknown
    }
  | null
  | undefined

/** Un abonnement est actif s'il est marqué "active" et que la période n'est pas expirée. */
export function isSubscriptionActive(subscription: SubscriptionLike): boolean {
  if (!subscription) return false
  return subscription.status === 'active' && subscription.currentPeriodEnd.getTime() > Date.now()
}

/** Ce que couvre un abonnement : rien s'il n'est pas actif. */
export interface Couverture {
  actif: boolean
  formule: CleFormule | null
  modules: ModulePayant[]
}

export function couvertureDe(subscription: SubscriptionAvecFormule): Couverture {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return { actif: false, formule: null, modules: [] }
  }
  return {
    actif: true,
    formule: subscription.formule as CleFormule,
    modules: modulesCouverts(subscription.formule, subscription.modules),
  }
}

/** Les colonnes à lire pour calculer une couverture. */
export const selectionCouverture = {
  status: true,
  currentPeriodEnd: true,
  formule: true,
  modules: true,
} as const

/** Renvoie l'abonnement de l'utilisateur s'il est actif, sinon null. */
export async function getActiveSubscription(userId: number) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } })
  return isSubscriptionActive(subscription) ? subscription : null
}

/**
 * Garde SERVEUR : lève une 402 si l'utilisateur n'a pas d'abonnement actif (n'importe quelle
 * formule). Sert à ce qui demande SON PROPRE abonnement, comme créer un événement. La gestion d'un
 * événement, elle, passe par la couverture de l'abonnement de son propriétaire
 * (`droitsSurEvenement`, droits-evenement.ts).
 */
export async function requireActiveSubscription(_event: H3Event, userId: number) {
  const subscription = await getActiveSubscription(userId)
  if (!subscription) {
    throw createError({ statusCode: 402, statusMessage: 'Abonnement requis' })
  }
  return subscription
}
