import { prisma } from '@@/server/utils/prisma'

import { requireUserSession } from '#imports'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Recharger les champs éventuellement manquants (telephone, profilePicture...)
  const full = await prisma.user.findUnique({
    // user peut être typé sans id dans le wrapper nuxt-auth-utils, on caste
    where: { id: (user as any).id },
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
  return { user: full || user }
})
