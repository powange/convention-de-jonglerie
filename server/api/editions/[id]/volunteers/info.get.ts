import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      volunteersOpen: true,
      volunteersDescription: true,
      volunteersMode: true,
      volunteersExternalUrl: true,
      volunteersAskDiet: true,
      volunteersAskAllergies: true,
      volunteersAskTimePreferences: true,
      volunteersAskTeamPreferences: true,
      volunteersTeams: true,
      volunteerApplications: { select: { id: true, status: true, userId: true } },
    },
  })
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Edition introuvable' })

  const user = event.context.user
  let myApplication: any = null
  if (user) {
    const found = edition.volunteerApplications.find((a) => a.userId === user.id)
    if (found) myApplication = { id: found.id, status: found.status }
  }
  const counts = edition.volunteerApplications.reduce(
    (acc, a) => {
      acc.total++
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    },
    { total: 0 } as any
  )

  return {
    open: edition.volunteersOpen,
    description: edition.volunteersDescription || null,
    mode: (edition as any).volunteersMode || 'INTERNAL',
    externalUrl: (edition as any).volunteersExternalUrl || null,
    askDiet: (edition as any).volunteersAskDiet || false,
    askAllergies: (edition as any).volunteersAskAllergies || false,
    askTimePreferences: (edition as any).volunteersAskTimePreferences || false,
    askTeamPreferences: (edition as any).volunteersAskTeamPreferences || false,
    teams: (edition as any).volunteersTeams || [],
    myApplication,
    counts,
  }
})
