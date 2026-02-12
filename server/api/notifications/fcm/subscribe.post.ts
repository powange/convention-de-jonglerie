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
    // Upsert atomique pour éviter les race conditions
    await prisma.fcmToken.upsert({
      where: {
        userId_token: {
          userId: session.user.id,
          token,
        },
      },
      update: {
        isActive: true,
        deviceId: deviceId || undefined,
        userAgent,
      },
      create: {
        userId: session.user.id,
        token,
        isActive: true,
        deviceId: deviceId || null,
        userAgent,
      },
    })

    return { success: true, message: 'Token FCM enregistré' }
  } catch (error: any) {
    console.error('[FCM Subscribe] Erreur:', error)
    throw createError({
      status: 500,
      message: "Erreur lors de l'enregistrement du token FCM",
    })
  }
})
