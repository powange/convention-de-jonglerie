/**
 * API pour désactiver un ou tous les tokens FCM de l'utilisateur
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const { token } = body || {}

  try {
    let result

    if (token && typeof token === 'string') {
      // Désactiver un token spécifique
      result = await prisma.fcmToken.updateMany({
        where: {
          userId: session.user.id,
          token,
        },
        data: {
          isActive: false,
        },
      })
      console.log(`🔕 [FCM] Token spécifique désactivé pour l'utilisateur ${session.user.id}`)
    } else {
      // Désactiver tous les tokens de l'utilisateur
      result = await prisma.fcmToken.updateMany({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
      console.log(
        `🔕 [FCM] Tous les tokens désactivés pour l'utilisateur ${session.user.id} (${result.count} tokens)`
      )
    }

    return {
      success: true,
      message: 'Token(s) FCM désactivé(s)',
      count: result.count,
    }
  } catch (error: any) {
    console.error('[FCM Unsubscribe] Erreur:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la désactivation du token FCM',
    })
  }
})
