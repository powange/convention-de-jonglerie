import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'

/**
 * API de test simple pour vérifier la connectivité admin
 */
export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    return {
      message: 'API admin fonctionnelle',
      userId: adminUser.id,
      isGlobalAdmin: adminUser.isGlobalAdmin,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[Test API] Erreur:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur de test API',
    })
  }
})
