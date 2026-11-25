import { z } from 'zod'

import { exigerAdministrateur } from '../../../utils/administration'

/** Tous les événements Flowvent, paginés, avec leur propriétaire et leurs chiffres. */
const schema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
})
const PAR_PAGE = 25

export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const { q, page } = schema.parse(getQuery(event))
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { location: { contains: q } },
          { owner: { email: { contains: q } } },
          { owner: { pseudo: { contains: q } } },
        ],
      }
    : {}

  const [total, evenements] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
      select: {
        id: true,
        publicId: true,
        name: true,
        location: true,
        startDate: true,
        endDate: true,
        timezone: true,
        createdAt: true,
        volunteersEnabled: true,
        owner: { select: { id: true, pseudo: true, email: true } },
        _count: {
          select: { editionOrganizers: true, volunteerApplications: true, volunteerTeams: true },
        },
      },
    }),
  ])

  return {
    total,
    parPage: PAR_PAGE,
    evenements: evenements.map(({ _count, ...e }) => ({
      ...e,
      organisateurs: _count.editionOrganizers,
      candidatures: _count.volunteerApplications,
      equipes: _count.volunteerTeams,
    })),
  }
})
