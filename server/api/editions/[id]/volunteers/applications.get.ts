import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { userWithNameSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId, validatePagination } from '@@/server/utils/validation-helpers'

import type { VolunteerApplicationWhereInput } from '@@/server/types/prisma-helpers'
import type { Prisma } from '@prisma/client'

const DEFAULT_PAGE_SIZE = 20

// Fonction pour convertir une date avec granularité en timestamp comparable
// Format: "YYYY-MM-DD_granularity" où granularity peut être:
// morning, noon, afternoon, evening
function parseDateTime(dateTimeStr: string | null): number {
  if (!dateTimeStr) return 0 // Les valeurs null vont à la fin

  const [datePart, timePart] = dateTimeStr.split('_')
  if (!datePart) return 0

  const date = new Date(datePart)
  const baseTime = date.getTime()

  // Ajouter des heures selon la granularité pour avoir un ordre chronologique correct
  const timeOffsets: Record<string, number> = {
    morning: 8 * 60 * 60 * 1000, // 8h
    noon: 12 * 60 * 60 * 1000, // 12h
    afternoon: 14 * 60 * 60 * 1000, // 14h
    evening: 19 * 60 * 60 * 1000, // 19h
  }

  const offset = timePart ? timeOffsets[timePart] || 0 : 0
  return baseTime + offset
}

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  // Récupérer le conventionId de l'édition pour charger les commentaires de toutes les éditions de la convention
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Édition non trouvée',
    })
  }

  const conventionId = edition.conventionId

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined
  const teamsFilter = query.teams as string | undefined
  const presenceFilter = query.presence as string | undefined
  const assignedTeamsFilter = query.assignedTeams as string | undefined
  const isExport = query.export === 'true'
  const { page } = validatePagination(event)
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
  )
  const sortFieldRaw = (query.sortField as string) || 'createdAt'
  const sortDirRaw = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'
  const sortSecondary = (query.sortSecondary as string) || '' // format "field:dir,field2:dir"
  const search = (query.search as string)?.trim()
  // Construction de la clause WHERE
  const conditions: VolunteerApplicationWhereInput[] = [{ editionId }]

  // Filtre par statut
  if (statusFilter) {
    conditions.push({ status: statusFilter })
  }

  // Filtre par équipes
  if (teamsFilter) {
    const teamIds = teamsFilter
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (teamIds.length > 0) {
      // Pour les champs JSON array, on cherche les candidatures qui contiennent au moins un des IDs d'équipes
      const teamConditions = teamIds.map((teamId) => ({
        teamPreferences: {
          array_contains: [teamId],
        },
      }))
      conditions.push({ OR: teamConditions })
    }
  }

  // Filtre par présence
  if (presenceFilter) {
    const presenceTypes = presenceFilter
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (presenceTypes.length > 0) {
      const presenceConditions = presenceTypes
        .map((presenceType) => {
          switch (presenceType) {
            case 'setup':
              return { setupAvailability: true }
            case 'event':
              return { eventAvailability: true }
            case 'teardown':
              return { teardownAvailability: true }
            default:
              return null
          }
        })
        .filter(Boolean)

      if (presenceConditions.length > 0) {
        conditions.push({ OR: presenceConditions })
      }
    }
  }

  // Filtre par équipes assignées
  if (assignedTeamsFilter) {
    const assignedTeamIds = assignedTeamsFilter
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (assignedTeamIds.length > 0) {
      const assignedTeamConditions = []

      // Gérer le cas "NO_TEAM" (aucune équipe assignée)
      if (assignedTeamIds.includes('NO_TEAM')) {
        assignedTeamConditions.push({
          teamAssignments: { none: {} },
        })
      }

      // Filtrer par équipes spécifiques (nouveau système VolunteerTeam)
      const specificTeamIds = assignedTeamIds.filter((id) => id !== 'NO_TEAM')
      if (specificTeamIds.length > 0) {
        assignedTeamConditions.push({
          teamAssignments: {
            some: {
              teamId: { in: specificTeamIds },
            },
          },
        })
      }

      if (assignedTeamConditions.length > 0) {
        conditions.push({ OR: assignedTeamConditions })
      }
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

  // Pour les champs de date avec granularité, on ne peut pas utiliser orderBy simple
  // car le format string "YYYY-MM-DD_granularity" n'est pas trié correctement
  // On va donc utiliser une requête avec ORDER BY SQL personnalisé
  const needsCustomSort = sortFieldRaw === 'arrivalDateTime' || sortFieldRaw === 'departureDateTime'

  const primary: Prisma.EditionVolunteerApplicationOrderByWithRelationInput = (() => {
    if (sortFieldRaw === 'pseudo') return { user: { pseudo: sortDirRaw } }
    if (sortFieldRaw === 'prenom') return { user: { prenom: sortDirRaw } }
    if (sortFieldRaw === 'nom') return { user: { nom: sortDirRaw } }
    if (sortFieldRaw === 'allergies') return { allergies: sortDirRaw }
    if (sortFieldRaw === 'status') return { status: sortDirRaw }
    if (sortFieldRaw === 'arrivalDateTime') return { arrivalDateTime: sortDirRaw }
    if (sortFieldRaw === 'departureDateTime') return { departureDateTime: sortDirRaw }
    return { createdAt: sortDirRaw }
  })()
  const orderBy: Prisma.EditionVolunteerApplicationOrderByWithRelationInput[] = [primary]
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
      else if (f === 'arrivalDateTime') orderBy.push({ arrivalDateTime: dir })
      else if (f === 'departureDateTime') orderBy.push({ departureDateTime: dir })
    }
  }

  const includeTeams = query.includeTeams === 'true'

  const selectFields: Prisma.EditionVolunteerApplicationSelect = {
    id: true,
    status: true,
    createdAt: true,
    motivation: true,
    userId: true,
    dietaryPreference: true,
    allergies: true,
    allergySeverity: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
    timePreferences: true,
    teamPreferences: true,
    acceptanceNote: true,
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
    source: true,
    addedById: true,
    addedAt: true,
    user: {
      select: {
        ...userWithNameSelect,
        email: true,
        phone: true,
        profilePicture: true,
        updatedAt: true,
        volunteerComments: {
          where: {
            edition: {
              conventionId,
            },
          },
          select: {
            content: true,
            createdAt: true,
            updatedAt: true,
            editionId: true,
            edition: {
              select: {
                name: true,
                startDate: true,
                endDate: true,
                convention: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    addedBy: {
      select: userWithNameSelect,
    },
    mealSelections: {
      select: {
        id: true,
        accepted: true,
        meal: {
          select: {
            id: true,
            date: true,
            mealType: true,
            phases: true,
          },
        },
      },
    },
  }

  if (includeTeams) {
    selectFields.teamAssignments = {
      select: {
        teamId: true,
        isLeader: true,
        assignedAt: true,
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            maxVolunteers: true,
          },
        },
      },
    }
  }

  let applications = await prisma.editionVolunteerApplication.findMany({
    where,
    orderBy: needsCustomSort ? { createdAt: 'desc' } : orderBy, // Si tri custom, on récupère tout d'abord
    // En cas d'export ou de tri custom, pas de pagination (on pagine après le tri)
    ...(isExport || needsCustomSort ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    select: selectFields,
  })

  // Si tri par date avec granularité, trier en mémoire
  if (needsCustomSort) {
    const field = sortFieldRaw as 'arrivalDateTime' | 'departureDateTime'
    applications = applications.sort((a, b) => {
      const timeA = parseDateTime(a[field])
      const timeB = parseDateTime(b[field])

      // Gérer les valeurs null (0) - les mettre à la fin
      if (timeA === 0 && timeB === 0) return 0
      if (timeA === 0) return 1 // a va à la fin
      if (timeB === 0) return -1 // b va à la fin

      const diff = timeA - timeB
      return sortDirRaw === 'asc' ? diff : -diff
    })

    // Appliquer la pagination après le tri
    if (!isExport) {
      const start = (page - 1) * pageSize
      applications = applications.slice(start, start + pageSize)
    }
  }

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
      'Contact urgence nom',
      'Contact urgence téléphone',
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
      const formatArray = (arr: unknown) => (Array.isArray(arr) ? arr.join('; ') : arr || '')
      const formatDate = (date: unknown) =>
        date instanceof Date || typeof date === 'string'
          ? new Date(date).toLocaleString('fr-FR')
          : ''
      const formatBoolean = (bool: boolean | null) => (bool ? 'Oui' : 'Non')

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
        app.emergencyContactName || '',
        app.emergencyContactPhone || '',
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

  return createPaginatedResponse(applications, total, page, pageSize)
}, 'GetVolunteerApplications')
