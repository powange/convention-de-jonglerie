/**
 * Les codes promo côté serveur : charger un code, savoir s'il s'applique à un compte, et choisir
 * celui qu'un paiement retient. La règle elle-même (validité, couverture, prix, durée) est dans
 * shared/codes-promo.ts, écrite une fois.
 */
import { couvre, normaliserCode, raisonRefus } from '../../shared/codes-promo'

import prisma from './prisma'

import type { PromoCode } from '#server/types/prisma'

/** Le code saisi, s'il existe (sans juger s'il s'applique). */
export async function chargerCode(saisie: unknown): Promise<PromoCode | null> {
  const code = normaliserCode(saisie)
  if (!code) return null
  return prisma.promoCode.findUnique({ where: { code } })
}

/** Pourquoi ce code ne s'applique pas à ce compte pour cette formule, ou `null`. */
export async function refusPourLeCompte(
  code: PromoCode,
  options: { userId: number | null; email: string | null; formule: string; periode: string }
): Promise<string | null> {
  const [utilisations, deja] = await Promise.all([
    prisma.promoCodeRedemption.count({ where: { promoCodeId: code.id } }),
    options.userId
      ? prisma.promoCodeRedemption.findUnique({
          where: { promoCodeId_userId: { promoCodeId: code.id, userId: options.userId } },
          select: { id: true },
        })
      : null,
  ])
  return raisonRefus(code, {
    formule: options.formule,
    periode: options.periode,
    maintenant: new Date(),
    email: options.email,
    utilisations,
    dejaUtiliseParLeCompte: !!deja,
  })
}

/**
 * Le code qu'un paiement SANS code saisi reprend d'office, ou `null` :
 * - celui de l'abonnement en cours, si son avantage court encore et qu'il couvre la nouvelle
 *   formule (changement de formule) ;
 * - à défaut, un code « à vie » déjà utilisé par le compte et qui couvre la formule — décision : un
 *   avantage à vie survit à une interruption d'abonnement (une association qui fait une pause entre
 *   deux saisons garde son tarif fondateur).
 * Un code désactivé depuis reste acquis à ceux qui l'ont utilisé, jusqu'au terme de son avantage.
 */
export async function codeRepris(
  userId: number,
  formule: string,
  periode: string
): Promise<{ code: PromoCode; finAvantage: Date | null } | null> {
  const maintenant = new Date()
  const abonnement = await prisma.subscription.findUnique({
    where: { userId },
    select: { advantageEndsAt: true, promoCode: true },
  })
  const enCours = abonnement?.promoCode
  if (enCours && couvre(enCours, formule, periode)) {
    const fin = abonnement.advantageEndsAt
    if (enCours.duration === 'forever' || (fin && fin > maintenant)) {
      return { code: enCours, finAvantage: enCours.duration === 'forever' ? null : fin }
    }
  }
  const aVie = await prisma.promoCodeRedemption.findMany({
    where: { userId, promoCode: { duration: 'forever' } },
    orderBy: { createdAt: 'desc' },
    select: { promoCode: true },
  })
  const repris = aVie.map((r) => r.promoCode).find((c) => couvre(c, formule, periode))
  return repris ? { code: repris, finAvantage: null } : null
}
