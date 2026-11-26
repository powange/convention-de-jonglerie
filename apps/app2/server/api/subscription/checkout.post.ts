import { z } from 'zod'

import { requireUserSession } from '#imports'

import {
  finAvantage,
  finPeriodeAvecCode,
  normaliserCode,
  prixRemise,
  resumeAvantage,
} from '../../../shared/codes-promo'
import {
  erreurChoixModules,
  finDePeriode,
  formule as definitionFormule,
  modulesCouverts,
} from '../../../shared/formules'
import { chargerCode, codeRepris, refusPourLeCompte } from '../../utils/codes-promo'
import prisma, { Prisma } from '../../utils/prisma'
import { SUBSCRIPTION_FORMULES, SUBSCRIPTION_PLANS } from '../../utils/subscription'

import type { PromoCode } from '#server/types/prisma'

/**
 * Souscrire (ou changer de formule) : une formule (solo, duo, integral), une période (`plan` :
 * mensuel ou annuel), pour Solo et Duo les modules choisis, et éventuellement un code promo.
 *
 * Sans code saisi, le paiement reprend d'office celui de l'abonnement en cours s'il vaut encore pour
 * la nouvelle formule, ou un code « à vie » déjà utilisé (server/utils/codes-promo.ts). Un seul code
 * par abonnement.
 */
const checkoutSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
  formule: z.enum(SUBSCRIPTION_FORMULES),
  modules: z.array(z.string()).max(10).optional(),
  code: z.string().max(64).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const resultat = checkoutSchema.safeParse(await readBody(event))
  if (!resultat.success) throw createError({ status: 400, message: 'Données invalides' })
  const { plan, formule } = resultat.data
  const modules = resultat.data.modules ?? []

  const erreur = erreurChoixModules(formule, modules)
  if (erreur) throw createError({ status: 400, message: erreur })

  const debut = new Date()
  const finPremiere = finDePeriode(debut, plan)
  const prix = definitionFormule(formule)!.prix[plan]

  // Le code retenu : celui qu'on a saisi (une NOUVELLE utilisation), sinon celui que l'on reprend.
  let applique: PromoCode | null = null
  let nouvelleUtilisation = false
  let avantageJusquau: Date | null = null
  const saisi = normaliserCode(resultat.data.code)
  const repris = await codeRepris(userId, formule, plan)
  if (saisi && repris?.code.code !== saisi) {
    const code = await chargerCode(saisi)
    if (!code)
      throw createError({ status: 400, message: 'Ce code est introuvable ou n’est plus valable' })
    const compte = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    const refus = await refusPourLeCompte(code, {
      userId,
      email: compte?.email ?? null,
      formule,
      periode: plan,
    })
    if (refus) throw createError({ status: 400, message: refus })
    applique = code
    nouvelleUtilisation = true
    avantageJusquau = finAvantage(code, debut, finPremiere)
  } else if (repris) {
    applique = repris.code
    avantageJusquau = repris.finAvantage
  }

  const montant = applique ? prixRemise(prix, applique) : prix
  // Une gratuité reprise garde son terme : elle ne recommence pas à chaque changement de formule.
  const currentPeriodEnd =
    applique?.advantage === 'free' && !nouvelleUtilisation && avantageJusquau
      ? avantageJusquau
      : finPeriodeAvecCode(applique, debut, finPremiere)

  // ⚠️ Paiement SIMULÉ : aucun prestataire de paiement réel n'est appelé.
  // On considère le paiement réussi et on active immédiatement l'abonnement.
  // Intégral couvre tout, y compris les modules à venir : rien à retenir.
  const choisis = formule === 'integral' ? null : modulesCouverts(formule, modules)
  const data = {
    plan,
    formule,
    status: 'active',
    currentPeriodEnd,
    promoCodeId: applique?.id ?? null,
    advantageEndsAt: applique ? avantageJusquau : null,
    amountPaid: montant,
  }

  const subscription = await prisma.$transaction(async (tx) => {
    if (applique && nouvelleUtilisation) {
      // Le plafond se revérifie DANS la transaction : deux paiements simultanés ne le dépassent pas.
      if (applique.maxRedemptions !== null) {
        const utilisations = await tx.promoCodeRedemption.count({
          where: { promoCodeId: applique.id },
        })
        if (utilisations >= applique.maxRedemptions) {
          throw createError({
            status: 400,
            message: "Ce code a atteint son nombre maximal d'utilisations",
          })
        }
      }
      await tx.promoCodeRedemption.create({
        data: { promoCodeId: applique.id, userId, formule, plan, amountPaid: montant },
      })
    }
    return tx.subscription.upsert({
      where: { userId },
      create: { userId, ...data, modules: choisis ?? undefined },
      // `modules: null` efface un choix précédent (passage à Intégral) ; Prisma veut `DbNull` pour
      // une colonne Json.
      update: { ...data, modules: choisis ?? Prisma.DbNull },
    })
  })

  return {
    success: true,
    subscription: {
      plan: subscription.plan,
      formule: subscription.formule,
      modules: modulesCouverts(subscription.formule, subscription.modules),
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      amountPaid: subscription.amountPaid,
      codePromo: applique ? { code: applique.code, resume: resumeAvantage(applique) } : null,
    },
  }
})
