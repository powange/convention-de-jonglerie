import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    console.log('=== DEBUG AUTH ===')

    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)
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
  },
  { operationName: 'DebugAuth' }
)
