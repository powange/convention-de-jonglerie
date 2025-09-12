import { requireGlobalAdmin } from '../../../utils/admin-auth'

/**
 * API de test simple pour vérifier la connectivité admin
 */
export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdmin(event)

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
      statusMessage: 'Erreur de test API',
    })
  }
})
