/**
 * GET /api/notifications/fcm/devices
 * Liste tous les appareils enregistrés pour les notifications push de l'utilisateur
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      status: 401,
      message: 'Non authentifié',
    })
  }

  try {
    const devices = await prisma.fcmToken.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return {
      success: true,
      data: devices,
    }
  } catch (error: any) {
    console.error('[FCM Devices] Erreur:', error)
    throw createError({
      status: 500,
      message: 'Erreur lors de la récupération des appareils',
    })
  }
})
