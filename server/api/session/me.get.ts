import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getImpersonationCookie } from '@@/server/utils/impersonation-helpers'

import { requireUserSession } from '#imports'

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    // Recharger les champs éventuellement manquants (telephone, profilePicture...)
    const full = await prisma.user.findUnique({
      // user peut être typé sans id dans le wrapper nuxt-auth-utils, on caste
      where: { id: (session.user as any).id },
      select: {
        id: true,
        email: true,
        emailHash: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        profilePicture: true,
        isGlobalAdmin: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Récupérer les informations d'impersonation depuis le cookie séparé
    const impersonation = getImpersonationCookie(event)

    return {
      user: full || session.user,
      impersonation: impersonation || null,
    }
  },
  { operationName: 'GetCurrentUserSession' }
)
