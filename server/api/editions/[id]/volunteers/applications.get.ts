import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const DEFAULT_PAGE_SIZE = 20

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id)
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
    })

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined
  const teamsFilter = query.teams as string | undefined
  const isExport = query.export === 'true'
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
  )
  const sortFieldRaw = (query.sortField as string) || 'createdAt'
  const sortDirRaw = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'
  const sortSecondary = (query.sortSecondary as string) || '' // format "field:dir,field2:dir"
  const search = (query.search as string)?.trim()
  // Construction de la clause WHERE
  const conditions: any[] = [{ editionId }]

  // Filtre par statut
  if (statusFilter) {
    conditions.push({ status: statusFilter })
  }

  // Filtre par équipes
  if (teamsFilter) {
    const teamNames = teamsFilter
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (teamNames.length > 0) {
      // Pour les champs JSON array, on cherche les candidatures qui contiennent au moins une des équipes
      const teamConditions = teamNames.map((teamName) => ({
        teamPreferences: {
          array_contains: [teamName],
        },
      }))
      conditions.push({ OR: teamConditions })
    }
  }

  // Filtre de recherche textuelle
  if (search) {
    const s = search.slice(0, 100)
    conditions.push({
      OR: [
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
      ],
    })
  }

  const where = conditions.length === 1 ? conditions[0] : { AND: conditions }
  const total = await prisma.editionVolunteerApplication.count({ where })
  const primary: any = (() => {
    if (sortFieldRaw === 'pseudo') return { user: { pseudo: sortDirRaw } }
    if (sortFieldRaw === 'prenom') return { user: { prenom: sortDirRaw } }
    if (sortFieldRaw === 'nom') return { user: { nom: sortDirRaw } }
    if (sortFieldRaw === 'allergies') return { allergies: sortDirRaw }
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
      else if (f === 'prenom') orderBy.push({ user: { prenom: dir } })
      else if (f === 'nom') orderBy.push({ user: { nom: dir } })
      else if (f === 'allergies') orderBy.push({ allergies: dir })
      else if (f === 'status') orderBy.push({ status: dir })
      else if (f === 'createdAt') orderBy.push({ createdAt: dir })
    }
  }

  const applications = await prisma.editionVolunteerApplication.findMany({
    where,
    orderBy,
    // En cas d'export, pas de pagination
    ...(isExport ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    select: {
      id: true,
      status: true,
      createdAt: true,
      motivation: true,
      userId: true,
      dietaryPreference: true,
      allergies: true,
      timePreferences: true,
      teamPreferences: true,
      hasPets: true,
      petsDetails: true,
      hasMinors: true,
      minorsDetails: true,
      hasVehicle: true,
      vehicleDetails: true,
      companionName: true,
      avoidList: true,
      skills: true,
      hasExperience: true,
      experienceDetails: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
      user: {
        select: { id: true, pseudo: true, email: true, phone: true, prenom: true, nom: true },
      },
    },
  })

  // Si c'est un export, générer le CSV
  if (isExport) {
    const csvHeaders = [
      'Date candidature',
      'Statut',
      'Pseudo',
      'Prénom',
      'Nom',
      'Email',
      'Téléphone',
      'Motivation',
      'Régime alimentaire',
      'Allergies',
      'Préférences horaires',
      'Équipes préférées',
      'Animaux',
      'Mineurs',
      'Véhicule',
      'Compagnons souhaités',
      'Personnes à éviter',
      'Compétences',
      'Expérience',
      'Montage',
      'Démontage',
      'Événement',
      'Arrivée',
      'Départ',
    ]

    const csvRows = applications.map((app) => {
      const formatArray = (arr: any) => (Array.isArray(arr) ? arr.join('; ') : arr || '')
      const formatDate = (date: any) => (date ? new Date(date).toLocaleString('fr-FR') : '')
      const formatBoolean = (bool: boolean) => (bool ? 'Oui' : 'Non')

      // Format spécial pour les dates avec granularité (format: date_granularity)
      const formatDateTimeWithGranularity = (dateTimeString: string) => {
        if (!dateTimeString || !dateTimeString.includes('_')) {
          return dateTimeString || ''
        }

        const [datePart, timePart] = dateTimeString.split('_')

        try {
          const date = new Date(datePart)
          const dateFormatted = date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
          })

          // Traduction des granularités en français
          const timeTranslations: Record<string, string> = {
            morning: 'matin',
            noon: 'midi',
            afternoon: 'après-midi',
            evening: 'soir',
          }

          const timeFormatted = timeTranslations[timePart] || timePart

          return `${dateFormatted} ${timeFormatted}`
        } catch {
          return dateTimeString.split('_').join(' ')
        }
      }

      return [
        formatDate(app.createdAt),
        app.status === 'PENDING' ? 'En attente' : app.status === 'ACCEPTED' ? 'Accepté' : 'Refusé',
        app.user.pseudo || '',
        app.user.prenom || '',
        app.user.nom || '',
        app.user.email || '',
        app.user.phone || '',
        app.motivation || '',
        app.dietaryPreference === 'VEGETARIAN'
          ? 'Végétarien'
          : app.dietaryPreference === 'VEGAN'
            ? 'Végan'
            : 'Aucun',
        app.allergies || '',
        formatArray(app.timePreferences),
        formatArray(app.teamPreferences),
        app.hasPets ? `Oui${app.petsDetails ? ` (${app.petsDetails})` : ''}` : 'Non',
        app.hasMinors ? `Oui${app.minorsDetails ? ` (${app.minorsDetails})` : ''}` : 'Non',
        app.hasVehicle ? `Oui${app.vehicleDetails ? ` (${app.vehicleDetails})` : ''}` : 'Non',
        app.companionName || '',
        app.avoidList || '',
        app.skills || '',
        app.hasExperience
          ? `Oui${app.experienceDetails ? ` (${app.experienceDetails})` : ''}`
          : 'Non',
        formatBoolean(app.setupAvailability),
        formatBoolean(app.teardownAvailability),
        formatBoolean(app.eventAvailability),
        formatDateTimeWithGranularity(app.arrivalDateTime || ''),
        formatDateTimeWithGranularity(app.departureDateTime || ''),
      ].map((cell) => `"${(cell || '').toString().replace(/"/g, '""')}"`)
    })

    const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n')

    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="candidatures-benevoles-edition-${editionId}.csv"`
    )

    return csvContent
  }

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
