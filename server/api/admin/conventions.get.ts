import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer toutes les conventions avec leurs éditions et organisateurs
    const conventions = await prisma.convention.findMany({
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            nom: true,
            prenom: true,
          },
        },
        organizers: {
          select: {
            id: true,
            title: true,
            canAddEdition: true,
            canDeleteAllEditions: true,
            canDeleteConvention: true,
            canEditAllEditions: true,
            canEditConvention: true,
            canManageOrganizers: true,
            canManageVolunteers: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                nom: true,
                prenom: true,
                profilePicture: true,
              },
            },
          },
        },
        editions: {
          include: {
            creator: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                nom: true,
                prenom: true,
              },
            },
            _count: {
              select: {
                volunteerApplications: true,
                carpoolOffers: true,
                carpoolRequests: true,
                lostFoundItems: true,
              },
            },
          },
          orderBy: {
            startDate: 'desc',
          },
        },
        _count: {
          select: {
            editions: true,
            organizers: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return {
      conventions,
      total: conventions.length,
    }
  },
  { operationName: 'GetAdminConventions' }
)
