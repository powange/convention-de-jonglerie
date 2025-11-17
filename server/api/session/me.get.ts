import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { getImpersonationCookie } from '@@/server/utils/impersonation-helpers'
import { prisma } from '@@/server/utils/prisma'

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
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        profilePicture: true,
        isGlobalAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Récupérer les informations d'impersonation depuis le cookie séparé
    const impersonation = getImpersonationCookie(event)

    // Transformer pour ajouter emailHash (garder email pour le formulaire de profil)
    const user = full || session.user
    const transformedUser = {
      ...user,
      emailHash: getEmailHash(user.email),
    }

    return {
      user: transformedUser,
      impersonation: impersonation || null,
    }
  },
  { operationName: 'GetCurrentUserSession' }
)
