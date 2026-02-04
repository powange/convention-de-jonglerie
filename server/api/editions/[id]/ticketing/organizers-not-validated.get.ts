import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message:
          "Droits insuffisants pour accéder à cette fonctionnalité - vous devez être gestionnaire ou en créneau actif de contrôle d'accès",
      })

    try {
      // Récupérer tous les EditionOrganizer non validés pour cette édition
      const editionOrganizers = await prisma.editionOrganizer.findMany({
        where: {
          editionId: editionId,
          entryValidated: false,
        },
        select: {
          id: true,
          organizer: {
            select: {
              id: true,
              title: true,
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
            },
          },
        },
      })

      // Trier manuellement par nom et prénom côté serveur
      const sortedOrganizers = editionOrganizers.sort((a, b) => {
        const nomA = a.organizer.user.nom || ''
        const nomB = b.organizer.user.nom || ''
        const prenomA = a.organizer.user.prenom || ''
        const prenomB = b.organizer.user.prenom || ''

        if (nomA !== nomB) {
          return nomA.localeCompare(nomB)
        }
        return prenomA.localeCompare(prenomB)
      })

      return {
        success: true,
        organizers: sortedOrganizers.map((editionOrganizer) => ({
          id: editionOrganizer.organizer.id, // ID du ConventionOrganizer pour la validation
          editionOrganizerId: editionOrganizer.id, // ID de l'EditionOrganizer pour le QR code
          user: {
            id: editionOrganizer.organizer.user.id,
            pseudo: editionOrganizer.organizer.user.pseudo,
            prenom: editionOrganizer.organizer.user.prenom,
            nom: editionOrganizer.organizer.user.nom,
            email: editionOrganizer.organizer.user.email,
            emailHash: editionOrganizer.organizer.user.emailHash,
            profilePicture: editionOrganizer.organizer.user.profilePicture,
          },
          title: editionOrganizer.organizer.title,
        })),
        total: sortedOrganizers.length,
      }
    } catch (error: unknown) {
      console.error('Failed to fetch organizers not validated:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des organisateurs non validés',
      })
    }
  },
  { operationName: 'GET ticketing organizers-not-validated' }
)
