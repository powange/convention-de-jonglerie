import { CLES_FORMULES, FORMULE_GRATUITE, PERIODES, formule } from '../../shared/formules'

import prisma from './prisma'

import type { CleFormule, Plafonds } from '../../shared/formules'

// Valeurs valides, centralisées dans shared/formules.ts et validées côté serveur (String en base).
// `plan` porte la PÉRIODE (mensuel ou annuel) ; la formule vit dans `formule`.
export const SUBSCRIPTION_PLANS = PERIODES
export const SUBSCRIPTION_FORMULES = CLES_FORMULES
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

type SubscriptionLike = { status: string; currentPeriodEnd: Date } | null | undefined

type SubscriptionAvecFormule =
  | { status: string; currentPeriodEnd: Date; formule: string }
  | null
  | undefined

/** Un abonnement est actif s'il est marqué "active" et que la période n'est pas expirée. */
export function isSubscriptionActive(subscription: SubscriptionLike): boolean {
  if (!subscription) return false
  return subscription.status === 'active' && subscription.currentPeriodEnd.getTime() > Date.now()
}

/**
 * La formule qui s'applique à un compte. Sans abonnement payant actif — jamais souscrit, ou
 * arrivé à son terme —, c'est la formule gratuite : tout compte a des plafonds, aucun n'est sans
 * formule (décision du 26/11/2026).
 */
export interface Couverture {
  /** Un abonnement payant est en cours. */
  payant: boolean
  formule: CleFormule
  plafonds: Plafonds
}

export function couvertureDe(subscription: SubscriptionAvecFormule): Couverture {
  const actif = isSubscriptionActive(subscription)
  const definition = (actif && formule(subscription!.formule)) || formule(FORMULE_GRATUITE)!
  return {
    payant: actif && definition.cle !== FORMULE_GRATUITE,
    formule: definition.cle,
    plafonds: definition.plafonds,
  }
}

/** Les colonnes à lire pour calculer une couverture. */
export const selectionCouverture = {
  status: true,
  currentPeriodEnd: true,
  formule: true,
} as const

/** La couverture d'un compte. */
export async function couvertureDuCompte(userId: number): Promise<Couverture> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: selectionCouverture,
  })
  return couvertureDe(subscription)
}
