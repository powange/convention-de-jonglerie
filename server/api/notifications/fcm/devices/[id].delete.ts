/**
 * DELETE /api/notifications/fcm/devices/[id]
 * Supprime un appareil enregistré pour les notifications push
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const deviceId = getRouterParam(event, 'id')

  if (!deviceId) {
    throw createError({
      statusCode: 400,
      message: "ID de l'appareil requis",
    })
  }

  try {
    // Vérifier que le token appartient à l'utilisateur
    const device = await prisma.fcmToken.findFirst({
      where: {
        id: deviceId,
        userId: session.user.id,
      },
    })

    if (!device) {
      throw createError({
        statusCode: 404,
        message: 'Appareil non trouvé',
      })
    }

    // Supprimer le token (ou le désactiver)
    await prisma.fcmToken.delete({
      where: { id: deviceId },
    })

    console.log(`🗑️ [FCM] Token supprimé pour l'utilisateur ${session.user.id}`)

    return {
      success: true,
      message: 'Appareil supprimé',
    }
  } catch (error: any) {
    if (error.statusCode) throw error

    console.error('[FCM Delete Device] Erreur:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'appareil",
    })
  }
})
