import { z } from 'zod'

import { AVANTAGES, DUREES, normaliserCode } from '../../../../shared/codes-promo'
import { CLES_FORMULES, PERIODES } from '../../../../shared/formules'
import { exigerAdministrateur } from '../../../utils/administration'
import { Prisma } from '../../../utils/prisma'

/**
 * Créer un code promo. Réglages calqués sur les coupons Stripe (shared/codes-promo.ts) : avantage
 * (pourcentage, montant en centimes, gratuité), formules et périodes visées (liste vide : toutes),
 * durée (premier paiement, N mois, à vie), validité, plafond, destinataire.
 */
const schemaCodePromo = z
  .object({
    code: z
      .string()
      .transform(normaliserCode)
      .pipe(z.string().min(3, 'Le code fait au moins 3 caractères')),
    label: z.string().trim().max(191).optional().nullable(),
    advantage: z.enum(AVANTAGES),
    value: z.number().int().min(0).max(100_000).default(0),
    formules: z.array(z.enum(CLES_FORMULES)).default([]),
    periods: z.array(z.enum(PERIODES)).default([]),
    duration: z.enum(DUREES),
    durationMonths: z.number().int().min(1).max(120).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    maxRedemptions: z.number().int().min(1).optional().nullable(),
    reservedEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(191)
      .optional()
      .nullable()
      .or(z.literal('')),
  })
  .superRefine((d, ctx) => {
    if (d.advantage === 'percent' && (d.value < 1 || d.value > 100)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Un pourcentage va de 1 à 100' })
    }
    if (d.advantage === 'amount' && d.value < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Indiquez le montant retiré' })
    }
    if (d.duration === 'months' && !d.durationMonths) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMonths'],
        message: 'Indiquez le nombre de mois',
      })
    }
    if (d.startsAt && d.expiresAt && d.expiresAt <= d.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'La fin doit suivre le début' })
    }
  })

export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const resultat = schemaCodePromo.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const d = resultat.data
  const existe = await prisma.promoCode.findUnique({
    where: { code: d.code },
    select: { id: true },
  })
  if (existe) throw createError({ status: 409, message: 'Ce code existe déjà' })

  const code = await prisma.promoCode.create({
    data: {
      code: d.code,
      label: d.label || null,
      advantage: d.advantage,
      value: d.advantage === 'free' ? 0 : d.value,
      // Liste vide : toutes les formules ou périodes (null en base).
      formules: d.formules.length ? d.formules : Prisma.DbNull,
      periods: d.periods.length ? d.periods : Prisma.DbNull,
      duration: d.duration,
      durationMonths: d.duration === 'months' ? (d.durationMonths ?? null) : null,
      startsAt: d.startsAt ?? null,
      expiresAt: d.expiresAt ?? null,
      maxRedemptions: d.maxRedemptions ?? null,
      reservedEmail: d.reservedEmail || null,
    },
  })
  return createSuccessResponse({ code }, 'Code créé')
})
