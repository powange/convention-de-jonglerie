import { requireUserSession } from '#imports'

import type { SessionMeResponse } from '#server/types/api-responses'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { getImpersonationCookie } from '#server/utils/impersonation-helpers'

export default wrapApiHandler<SessionMeResponse>(
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
        pronouns: true,
        profilePicture: true,
        isGlobalAdmin: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        /*
         * La langue du profil, pour que le client l'applique à l'hydratation. Sans ce champ dans la
         * réponse, l'interface reste dans la langue du NAVIGATEUR alors que la personne a
         * explicitement choisi la sienne dans son profil — et le réglage paraît sans effet.
         */
        preferredLanguage: true,
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Récupérer les informations d'impersonation depuis la session scellée
    const impersonation = await getImpersonationCookie(event)

    return {
      user: full || session.user,
      impersonation: impersonation || null,
    }
  },
  { operationName: 'GetCurrentUserSession' }
)
