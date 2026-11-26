import { z } from 'zod'

import { exigerAdministrateur } from '../../../utils/administration'
import { isSubscriptionActive } from '../../../utils/subscription'

/**
 * Les comptes Flowvent, paginés : recherche (e-mail, pseudo, prénom, nom), tri.
 */
const schema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  tri: z.enum(['inscription', 'connexion', 'pseudo']).default('inscription'),
})
const PAR_PAGE = 25

export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const { q, page, tri } = schema.parse(getQuery(event))

  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { pseudo: { contains: q } },
          { prenom: { contains: q } },
          { nom: { contains: q } },
        ],
      }
    : {}
  const orderBy =
    tri === 'connexion'
      ? [{ lastLoginAt: { sort: 'desc' as const, nulls: 'last' as const } }]
      : tri === 'pseudo'
        ? [{ pseudo: 'asc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [total, comptes] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
      select: {
        id: true,
        email: true,
        emailHash: true,
        pseudo: true,
        prenom: true,
        nom: true,
        profilePicture: true,
        updatedAt: true,
        authProvider: true,
        isEmailVerified: true,
        isGlobalAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        subscription: {
          select: {
            plan: true,
            formule: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
        _count: { select: { events: true, volunteerApplications: true } },
      },
    }),
  ])

  return {
    total,
    parPage: PAR_PAGE,
    comptes: comptes.map(({ subscription, _count, ...c }) => ({
      ...c,
      abonne: isSubscriptionActive(subscription),
      formule: subscription?.formule ?? null,
      periode: subscription?.plan ?? null,
      evenements: _count.events,
      candidatures: _count.volunteerApplications,
    })),
  }
})
