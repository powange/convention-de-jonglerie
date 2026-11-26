import { z } from 'zod'

import { requireUserSession } from '#imports'

import { erreurChoixModules, finDePeriode, modulesCouverts } from '../../../shared/formules'
import prisma, { Prisma } from '../../utils/prisma'
import { SUBSCRIPTION_FORMULES, SUBSCRIPTION_PLANS } from '../../utils/subscription'

/**
 * Souscrire (ou changer de formule) : une formule (solo, duo, integral), une période (`plan` :
 * mensuel ou annuel) et, pour Solo et Duo, les modules choisis.
 */
const checkoutSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
  formule: z.enum(SUBSCRIPTION_FORMULES),
  modules: z.array(z.string()).max(10).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const resultat = checkoutSchema.safeParse(await readBody(event))
  if (!resultat.success) throw createError({ status: 400, message: 'Données invalides' })
  const { plan, formule } = resultat.data
  const modules = resultat.data.modules ?? []

  const erreur = erreurChoixModules(formule, modules)
  if (erreur) throw createError({ status: 400, message: erreur })

  // ⚠️ Paiement SIMULÉ : aucun prestataire de paiement réel n'est appelé.
  // On considère le paiement réussi et on active immédiatement l'abonnement.
  const currentPeriodEnd = finDePeriode(new Date(), plan)
  // Intégral couvre tout, y compris les modules à venir : rien à retenir.
  const choisis = formule === 'integral' ? null : modulesCouverts(formule, modules)
  const data = {
    plan,
    formule,
    modules: choisis ?? undefined,
    status: 'active',
    currentPeriodEnd,
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    // `modules: null` efface un choix précédent (passage à Intégral) ; Prisma veut `DbNull` pour
    // une colonne Json.
    update: { ...data, modules: choisis ?? Prisma.DbNull },
  })

  return {
    success: true,
    subscription: {
      plan: subscription.plan,
      formule: subscription.formule,
      modules: modulesCouverts(subscription.formule, subscription.modules),
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  }
})
