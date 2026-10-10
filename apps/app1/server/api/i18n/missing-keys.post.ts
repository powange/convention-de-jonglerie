import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { createRateLimiter } from '#server/utils/rate-limiter'

/**
 * Dix appels par minute et par adresse.
 *
 * ## ⚠️ POURQUOI (constat A4)
 *
 * Cette route est **publique** — des clés peuvent manquer sur une page que personne n'a ouverte en
 * étant connecté — et elle ÉCRIT en base : une ligne par clé inconnue, cinquante clés par appel.
 * La déduplication, ajoutée avant ce lot, empêche la même clé d'ajouter deux lignes, mais elle ne
 * borne pas le nombre de clés DISTINCTES qu'un visiteur peut inventer. Sans limiteur, n'importe qui
 * pouvait remplir le journal d'administration, que la purge ne vide qu'à quatre-vingt-dix jours.
 *
 * Dix appels par minute laissent largement passer l'usage réel : le client regroupe les clés
 * manquantes d'une page en un seul envoi, et une page en manque rarement plus de cinquante.
 *
 * La clé est l'ADRESSE et non l'utilisateur : la route accepte les anonymes, et compter par compte
 * laisserait le cas qu'on veut précisément borner.
 */
const limiteurDesClesManquantes = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Trop de remontées de clés manquantes, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const ip =
      (String(event.node.req.headers['x-forwarded-for'] || '').split(',')[0] ?? '').trim() ||
      event.node.req.socket.remoteAddress ||
      'unknown'
    return `i18n-missing:${ip}`
  },
})

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
 * Route publique (des clés peuvent manquer sur des pages publiques) — validée, bornée (≤ 50 clés),
 * dédupliquée, et limitée à dix appels par minute et par adresse.
 *
 * ⚠️ PAS DE FILTRE SUR LE DOMAINE DE LA CLÉ, et c'est délibéré. La fiche d'audit proposait de
 * n'accepter que les clés dont le premier segment est un domaine i18n connu. Deux raisons de ne pas
 * le faire :
 *
 * 1. **Cela ne borne rien.** Le nombre de domaines est fini, mais les suffixes ne le sont pas :
 *    `common.aaaa`, `common.aaab`… restent autant de clés distinctes, donc autant de lignes. C'est
 *    le limiteur de débit qui borne la table, pas la liste des domaines.
 * 2. **Cela diverger­ait entre développement et production.** La liste se déduirait des fichiers de
 *    locales, et `volunteers` n'existe que dans `layers/volunteers/i18n` — un dossier que l'image
 *    de production ne contient pas. Les clés `volunteers.*` seraient donc acceptées ici et refusées
 *    là-bas, c'est-à-dire précisément là où l'on cherche les clés manquantes.
 */
export default wrapApiHandler(
  async (event) => {
    await limiteurDesClesManquantes(event)

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
