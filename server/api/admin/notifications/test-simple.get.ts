import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

/**
 * API de test simple pour vérifier la connectivité admin
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    return {
      message: 'API admin fonctionnelle',
      userId: adminUser.id,
      isGlobalAdmin: adminUser.isGlobalAdmin,
      timestamp: new Date().toISOString(),
    }
  },
  { operationName: 'TestSimpleAdminApi' }
)
