/**
 * API pour enregistrer un token FCM
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      status: 401,
      message: 'Non authentifié',
    })
  }

  const { token, deviceId } = await readBody(event)

  if (!token || typeof token !== 'string') {
    throw createError({
      status: 400,
      message: 'Token FCM requis',
    })
  }

  // Récupérer le User-Agent pour identifier l'appareil (informatif)
  const userAgent = getHeader(event, 'user-agent') || null

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
      // Mettre à jour le deviceId, User-Agent et réactiver si désactivé
      await prisma.fcmToken.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          deviceId: deviceId || existing.deviceId,
          userAgent,
        },
      })

      return { success: true, message: 'Token FCM déjà enregistré' }
    }

    // Créer le nouveau token
    await prisma.fcmToken.create({
      data: {
        userId: session.user.id,
        token,
        isActive: true,
        deviceId: deviceId || null,
        userAgent,
      },
    })

    console.log(`✅ [FCM] Token enregistré pour l'utilisateur ${session.user.id}`)

    return { success: true, message: 'Token FCM enregistré' }
  } catch (error: any) {
    console.error('[FCM Subscribe] Erreur:', error)
    throw createError({
      status: 500,
      message: "Erreur lors de l'enregistrement du token FCM",
    })
  }
})
