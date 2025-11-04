import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
  const user = requireAuth(event)

  const editionId = validateEditionId(event)

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
        entryValidated: false,
        OR: [
          {
            eventAvailability: true,
          },
          {
            eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
          },
        ],
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
      orderBy: { id: 'desc' },
    })

    // Trier manuellement par nom et prénom côté serveur
    const sortedVolunteers = volunteers.sort((a, b) => {
      const nomA = a.user.nom || ''
      const nomB = b.user.nom || ''
      const prenomA = a.user.prenom || ''
      const prenomB = b.user.prenom || ''

      if (nomA !== nomB) {
        return nomA.localeCompare(nomB)
      }
      return prenomA.localeCompare(prenomB)
    })

    return {
      success: true,
      volunteers: sortedVolunteers.map((volunteer) => ({
        id: volunteer.id,
        user: {
          id: volunteer.user.id,
          pseudo: volunteer.user.pseudo,
          prenom: volunteer.user.prenom,
          nom: volunteer.user.nom,
          email: volunteer.user.email,
          emailHash: getEmailHash(volunteer.user.email),
          profilePicture: volunteer.user.profilePicture,
        },
        teams: volunteer.teamAssignments.map((assignment) => assignment.team),
      })),
      total: sortedVolunteers.length,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch volunteers not validated:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des bénévoles non validés',
    })
  }
  },
  { operationName: 'GET ticketing volunteers-not-validated' }
)
