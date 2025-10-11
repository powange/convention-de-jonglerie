import { prisma } from '../../prisma'

/**
 * Récupère les équipes de bénévoles d'une édition
 */
export async function getVolunteerTeams(editionId: number) {
  return await prisma.volunteerTeam.findMany({
    where: { editionId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      maxVolunteers: true,
    },
  })
}

/**
 * Récupère une équipe de bénévoles par son ID
 */
export async function getVolunteerTeamById(teamId: string) {
  return await prisma.volunteerTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      maxVolunteers: true,
      editionId: true,
    },
  })
}

/**
 * Récupère les assignations d'équipes d'un bénévole
 */
export async function getVolunteerTeamAssignments(applicationId: number) {
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      teamAssignments: {
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
            },
          },
        },
      },
    },
  })

  return application?.teamAssignments || []
}

/**
 * Assigne un bénévole à des équipes (remplace les assignations existantes)
 * @param applicationId - ID de la candidature du bénévole
 * @param teamIds - Tableau d'IDs d'équipes
 * @returns Les nouvelles assignations créées
 */
export async function assignVolunteerToTeams(applicationId: number, teamIds: string[]) {
  return await prisma.$transaction(async (tx) => {
    // Supprimer toutes les assignations existantes
    await tx.applicationTeamAssignment.deleteMany({
      where: { applicationId },
    })

    // Dédupliquer les teamIds
    const uniqueTeamIds = [...new Set(teamIds)]

    // Créer les nouvelles assignations
    if (uniqueTeamIds.length > 0) {
      await tx.applicationTeamAssignment.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          applicationId,
          teamId,
          isLeader: false,
        })),
      })
    }


    // Récupérer et retourner les assignations créées
    return await tx.applicationTeamAssignment.findMany({
      where: { applicationId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          },
        },
      },
    })
  })
}

/**
 * Ajoute un bénévole à une équipe (conserve les assignations existantes)
 * @param applicationId - ID de la candidature du bénévole
 * @param teamId - ID de l'équipe
 * @returns L'assignation créée
 */
export async function addVolunteerToTeam(applicationId: number, teamId: string) {
  return await prisma.$transaction(async (tx) => {
    // Vérifier si l'assignation existe déjà
    const existingAssignment = await tx.applicationTeamAssignment.findUnique({
      where: {
        applicationId_teamId: {
          applicationId,
          teamId,
        },
      },
    })

    if (existingAssignment) {
      return existingAssignment
    }

    // Créer la nouvelle assignation
    const assignment = await tx.applicationTeamAssignment.create({
      data: {
        applicationId,
        teamId,
        isLeader: false,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          },
        },
      },
    })


    return assignment
  })
}

/**
 * Retire un bénévole d'une équipe spécifique
 * @param applicationId - ID de la candidature du bénévole
 * @param teamId - ID de l'équipe
 */
export async function removeVolunteerFromTeam(applicationId: number, teamId: string) {
  return await prisma.$transaction(async (tx) => {
    // Supprimer l'assignation
    await tx.applicationTeamAssignment.delete({
      where: {
        applicationId_teamId: {
          applicationId,
          teamId,
        },
      },
    })

  })
}

/**
 * Définit ou retire le statut de responsable d'un bénévole pour une équipe
 * @param applicationId - ID de la candidature du bénévole
 * @param teamId - ID de l'équipe
 * @param isLeader - true pour définir comme responsable, false pour retirer
 */
export async function setTeamLeader(applicationId: number, teamId: string, isLeader: boolean) {
  return await prisma.applicationTeamAssignment.update({
    where: {
      applicationId_teamId: {
        applicationId,
        teamId,
      },
    },
    data: {
      isLeader,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
        },
      },
    },
  })
}

/**
 * Vérifie si un bénévole est responsable d'une équipe
 * @param applicationId - ID de la candidature du bénévole
 * @param teamId - ID de l'équipe
 * @returns true si le bénévole est responsable, false sinon
 */
export async function isTeamLeader(applicationId: number, teamId: string): Promise<boolean> {
  const assignment = await prisma.applicationTeamAssignment.findUnique({
    where: {
      applicationId_teamId: {
        applicationId,
        teamId,
      },
    },
    select: {
      isLeader: true,
    },
  })

  return assignment?.isLeader || false
}

/**
 * Récupère tous les bénévoles assignés à une équipe
 * @param teamId - ID de l'équipe
 * @param options - Options de filtrage et tri
 */
export async function getTeamVolunteers(
  teamId: string,
  options?: {
    includeLeadersFirst?: boolean
    includeUserDetails?: boolean
  }
) {
  const assignments = await prisma.applicationTeamAssignment.findMany({
    where: { teamId },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          user: options?.includeUserDetails
            ? {
                select: {
                  id: true,
                  pseudo: true,
                  prenom: true,
                  nom: true,
                  email: true,
                },
              }
            : undefined,
        },
      },
    },
    orderBy: options?.includeLeadersFirst ? { isLeader: 'desc' } : undefined,
  })

  return assignments
}

/**
 * Compte le nombre de bénévoles assignés à une équipe
 * @param teamId - ID de l'équipe
 * @returns Le nombre de bénévoles assignés
 */
export async function countTeamVolunteers(teamId: string): Promise<number> {
  return await prisma.applicationTeamAssignment.count({
    where: { teamId },
  })
}

/**
 * Récupère les statistiques d'une équipe
 * @param teamId - ID de l'équipe
 */
export async function getTeamStats(teamId: string) {
  const [team, totalVolunteers, leadersCount] = await Promise.all([
    prisma.volunteerTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        maxVolunteers: true,
      },
    }),
    prisma.applicationTeamAssignment.count({
      where: { teamId },
    }),
    prisma.applicationTeamAssignment.count({
      where: {
        teamId,
        isLeader: true,
      },
    }),
  ])

  if (!team) {
    return null
  }

  return {
    teamId: team.id,
    teamName: team.name,
    totalVolunteers,
    leadersCount,
    maxVolunteers: team.maxVolunteers,
    utilizationRate: team.maxVolunteers
      ? Math.round((totalVolunteers / team.maxVolunteers) * 100)
      : null,
    hasCapacity: team.maxVolunteers ? totalVolunteers < team.maxVolunteers : true,
  }
}

/**
 * Résout les IDs ou noms d'équipes en IDs
 * Utile pour gérer l'ancien système où on pouvait passer des noms
 * @param editionId - ID de l'édition
 * @param identifiers - Tableau d'IDs ou de noms d'équipes
 * @returns Tableau d'IDs d'équipes
 */
export async function resolveTeamIdentifiers(
  editionId: number,
  identifiers: string[]
): Promise<string[]> {
  const teams = await prisma.volunteerTeam.findMany({
    where: { editionId },
    select: { id: true, name: true },
  })

  const resolvedIds: string[] = []

  for (const identifier of identifiers) {
    // Chercher d'abord par ID
    let team = teams.find((t) => t.id === identifier)

    // Si pas trouvé, chercher par nom
    if (!team) {
      team = teams.find((t) => t.name.toLowerCase().trim() === identifier.toLowerCase().trim())
    }

    if (team) {
      resolvedIds.push(team.id)
    } else {
      throw new Error(`Équipe "${identifier}" introuvable dans cette édition`)
    }
  }

  return resolvedIds
}
