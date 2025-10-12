import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const slotId = getRouterParam(event, 'slotId') as string

  console.log(
    `[DELETE SLOT] Tentative de suppression - Edition ID: ${editionId}, Slot ID: ${slotId}`
  )

  if (!editionId || isNaN(editionId)) {
    console.log(`[DELETE SLOT ERROR] ID d'édition invalide: ${editionId}`)
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  if (!slotId) {
    console.log(`[DELETE SLOT ERROR] ID de créneau invalide: ${slotId}`)
    throw createError({
      statusCode: 400,
      message: 'ID de créneau invalide',
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  console.log(`[DELETE SLOT] Vérification des permissions pour l'édition ${editionId}`)
  await requireVolunteerManagementAccess(event, editionId)

  try {
    console.log(`[DELETE SLOT] Recherche du créneau ${slotId} pour l'édition ${editionId}`)

    // Vérifier que le créneau existe et appartient à cette édition
    const existingSlot = await prisma.volunteerTimeSlot.findFirst({
      where: {
        id: slotId,
        editionId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    console.log(
      `[DELETE SLOT] Créneau trouvé:`,
      existingSlot
        ? `ID: ${existingSlot.id}, Assignations: ${existingSlot._count.assignments}`
        : 'non trouvé'
    )

    if (!existingSlot) {
      console.log(`[DELETE SLOT ERROR] Créneau non trouvé: ${slotId} pour l'édition ${editionId}`)
      throw createError({
        statusCode: 404,
        message: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    console.log(`[DELETE SLOT] Début de la transaction de suppression`)

    // Supprimer le créneau et ses assignations dans une transaction
    const result = await prisma.$transaction([
      // D'abord supprimer toutes les assignations
      prisma.volunteerAssignment.deleteMany({
        where: { timeSlotId: slotId },
      }),
      // Puis supprimer le créneau
      prisma.volunteerTimeSlot.delete({
        where: { id: slotId },
      }),
    ])

    console.log(`[DELETE SLOT] Transaction terminée avec succès:`, result)

    setResponseStatus(event, 204)
    return null
  } catch (error: any) {
    console.error(`[DELETE SLOT ERROR] Erreur détaillée:`, {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    })

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: `Erreur lors de la suppression du créneau: ${error.message}`,
    })
  }
})
