import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
  const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message:
        "Droits insuffisants pour accéder à cette fonctionnalité - vous devez être gestionnaire ou en créneau actif de contrôle d'accès",
    })

  try {
    // Récupérer tous les bénévoles acceptés qui n'ont pas validé leur billet
    const volunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        editionId,
        status: 'ACCEPTED',
        entryValidated: {
          not: true,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            email: true,
            emailHash: true,
            profilePicture: true,
          },
        },
        teamAssignments: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ user: { nom: 'asc' } }, { user: { prenom: 'asc' } }],
    })

    return {
      success: true,
      volunteers: volunteers.map((volunteer) => ({
        id: volunteer.id,
        user: {
          id: volunteer.user.id,
          pseudo: volunteer.user.pseudo,
          prenom: volunteer.user.prenom,
          nom: volunteer.user.nom,
          email: volunteer.user.email,
          emailHash: volunteer.user.emailHash,
          profilePicture: volunteer.user.profilePicture,
        },
        teams: volunteer.teamAssignments.map((assignment) => assignment.team),
      })),
      total: volunteers.length,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch volunteers not validated:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des bénévoles non validés',
    })
  }
})
