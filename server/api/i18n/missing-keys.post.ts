import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'

// Une clé i18n ressemble à un chemin pointé (ex. « edition.ticketing.config_title »).
const keyEntrySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_$][\w$.-]*$/, 'Clé i18n invalide'),
  locale: z.string().min(2).max(10),
})

const bodySchema = z.object({
  keys: z.array(keyEntrySchema).min(1).max(50),
  path: z.string().max(500).optional(),
})

/**
 * POST /api/i18n/missing-keys
 *
 * Reçoit les clés de traduction manquantes détectées côté client (handler `missing` de vue-i18n)
 * et les journalise dans `ApiErrorLog` (errorType `I18nMissingKey`) afin de constituer un historique
 * consultable dans /admin/error-logs (filtre par type). Dédupliqué par clé (1 ligne par clé, avec un
 * compteur d'occurrences + la liste des locales + la dernière page concernée).
 *
 * Route publique (des clés peuvent manquer sur des pages publiques) — validée, bornée (≤ 50 clés) et
 * dédupliquée pour éviter toute croissance incontrôlée de la table.
 */
export default wrapApiHandler(
  async (event) => {
    const body = bodySchema.parse(await readBody(event))
    const path = (body.path || '/').slice(0, 500)
    const userId = (event.context.user as { id?: number } | null)?.id ?? null

    // Dédupliquer les clés du lot (la même clé peut arriver plusieurs fois)
    const unique = new Map<string, string>() // clé -> locale (la première rencontrée)
    for (const { key, locale } of body.keys) if (!unique.has(key)) unique.set(key, locale)

    for (const [key, locale] of unique) {
      const existing = await prisma.apiErrorLog.findFirst({
        where: { errorType: 'I18nMissingKey', message: key },
        select: { id: true, prismaDetails: true },
      })

      if (existing) {
        const details = (existing.prismaDetails as Record<string, unknown> | null) || {}
        const occurrences = (Number(details.occurrences) || 1) + 1
        const locales = Array.from(
          new Set([...((details.locales as string[] | undefined) || []), locale])
        )
        await prisma.apiErrorLog.update({
          where: { id: existing.id },
          data: {
            resolved: false, // une clé qui réapparaît redevient « à traiter »
            path,
            url: path,
            prismaDetails: { ...details, locales, occurrences, lastPath: path },
          },
        })
      } else {
        await prisma.apiErrorLog.create({
          data: {
            message: key,
            statusCode: 0, // sentinelle : ce n'est pas une erreur HTTP
            errorType: 'I18nMissingKey',
            method: 'I18N',
            url: path,
            path,
            referer: path,
            userId,
            prismaDetails: { locales: [locale], occurrences: 1, lastPath: path },
          },
        })
      }
    }

    return { success: true, count: unique.size }
  },
  { operationName: 'ReportMissingI18nKeys' }
)
