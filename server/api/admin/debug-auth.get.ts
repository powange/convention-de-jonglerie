import { requireUserSession } from '#imports'

import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    console.log('=== DEBUG AUTH ===')

    // Essayer de récupérer la session
    const { user } = await requireUserSession(event)
    console.log('Session user:', user)

    const userId = user.id
    console.log('User ID from session:', userId)

    if (!userId) {
      return {
        error: 'No userId in session',
        sessionData: user,
      }
    }

    // Vérifier l'utilisateur en base
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        pseudo: true,
        isGlobalAdmin: true,
      },
    })

    console.log('User from database:', currentUser)

    return {
      sessionUser: user,
      dbUser: currentUser,
      hasAdminRights: currentUser?.isGlobalAdmin || false,
      debug: {
        userId,
        userExists: !!currentUser,
        isAdmin: currentUser?.isGlobalAdmin,
      },
    }
  } catch (error) {
    console.error('Auth debug error:', error)
    return {
      error: error.message,
      stack: error.stack?.slice(0, 500),
    }
  }
})
