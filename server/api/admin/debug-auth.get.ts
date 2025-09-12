import { requireGlobalAdmin } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  try {
    console.log('=== DEBUG AUTH ===')

    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdmin(event)
    console.log('Admin user:', adminUser)

    return {
      adminUser,
      hasAdminRights: adminUser.isGlobalAdmin,
      debug: {
        userId: adminUser.id,
        userExists: true,
        isAdmin: adminUser.isGlobalAdmin,
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
