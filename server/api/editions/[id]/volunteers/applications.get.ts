import { canEditEdition } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const DEFAULT_PAGE_SIZE = 20

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })

  const allowed = await canEditEdition(editionId, event.context.user.id)
  if (!allowed) throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
  )
  const sortFieldRaw = (query.sortField as string) || 'createdAt'
  const sortDirRaw = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'
  const sortSecondary = (query.sortSecondary as string) || '' // format "field:dir,field2:dir"
  const search = (query.search as string)?.trim()
  const where: any = { editionId }
  if (statusFilter) where.status = statusFilter
  if (search) {
    const s = search.slice(0, 100)
    where.OR = [
      { motivation: { contains: s } },
      {
        user: {
          is: {
            OR: [
              { pseudo: { contains: s } },
              { email: { contains: s } },
              { prenom: { contains: s } },
              { nom: { contains: s } },
            ],
          },
        },
      },
    ]
  }
  const total = await prisma.editionVolunteerApplication.count({ where })
  const primary: any = (() => {
    if (sortFieldRaw === 'pseudo') return { user: { pseudo: sortDirRaw } }
    if (sortFieldRaw === 'status') return { status: sortDirRaw }
    return { createdAt: sortDirRaw }
  })()
  const orderBy: any[] = [primary]
  if (sortSecondary) {
    const parts = sortSecondary
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    for (const p of parts) {
      const [f, d] = p.split(':')
      const dir = d === 'asc' ? 'asc' : 'desc'
      if (f === 'pseudo') orderBy.push({ user: { pseudo: dir } })
      else if (f === 'status') orderBy.push({ status: dir })
      else if (f === 'createdAt') orderBy.push({ createdAt: dir })
    }
  }

  const applications = await prisma.editionVolunteerApplication.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      status: true,
      createdAt: true,
      motivation: true,
      userId: true,
      dietaryPreference: true,
      allergies: true,
      timePreferences: true,
      user: {
        select: { id: true, pseudo: true, email: true, phone: true, prenom: true, nom: true },
      },
    },
  })
  return {
    applications,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
})
