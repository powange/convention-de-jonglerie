import { requireAuth } from '@@/server/utils/auth-utils'
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
      // Récupérer tous les artistes qui n'ont pas validé leur billet
      const artists = await prisma.editionArtist.findMany({
        where: {
          editionId,
          entryValidated: false,
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
          shows: {
            select: {
              show: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      })

      // Trier manuellement par nom et prénom côté serveur
      const sortedArtists = artists.sort((a, b) => {
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
        artists: sortedArtists.map((artist) => ({
          id: artist.id,
          user: {
            id: artist.user.id,
            pseudo: artist.user.pseudo,
            prenom: artist.user.prenom,
            nom: artist.user.nom,
            email: artist.user.email,
            emailHash: artist.user.emailHash,
            profilePicture: artist.user.profilePicture,
          },
          shows: artist.shows.map((showArtist) => showArtist.show),
        })),
        total: sortedArtists.length,
      }
    } catch (error: unknown) {
      console.error('Failed to fetch artists not validated:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des artistes non validés',
      })
    }
  },
  { operationName: 'GET ticketing artists-not-validated' }
)
