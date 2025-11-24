/**
 * API pour enregistrer un token FCM
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const { token } = await readBody(event)

  if (!token || typeof token !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Token FCM requis',
    })
  }

  try {
    // Vérifier si le token existe déjà
    const existing = await prisma.fcmToken.findUnique({
      where: {
        userId_token: {
          userId: session.user.id,
          token,
        },
      },
    })

    if (existing) {
      // Réactiver si désactivé
      if (!existing.isActive) {
        await prisma.fcmToken.update({
          where: { id: existing.id },
          data: { isActive: true },
        })
      }

      return { success: true, message: 'Token FCM déjà enregistré' }
    }

    // Créer le nouveau token
    await prisma.fcmToken.create({
      data: {
        userId: session.user.id,
        token,
        isActive: true,
      },
    })

    console.log(`✅ [FCM] Token enregistré pour l'utilisateur ${session.user.id}`)

    return { success: true, message: 'Token FCM enregistré' }
  } catch (error: any) {
    console.error('[FCM Subscribe] Erreur:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'enregistrement du token FCM",
    })
  }
})
