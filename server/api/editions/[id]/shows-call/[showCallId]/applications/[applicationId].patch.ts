import type { Prisma } from '@prisma/client'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { showApplicationStatusSchema } from '#server/utils/validation-schemas'

/**
 * Met à jour le statut d'une candidature de spectacle
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))
    const applicationId = Number(getRouterParam(event, 'applicationId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    if (isNaN(applicationId)) {
      throw createError({
        status: 400,
        message: 'ID de candidature invalide',
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour modifier cette candidature",
      })
    }

    // Récupérer la candidature
    const application = await prisma.showApplication.findFirst({
      where: {
        id: applicationId,
        showCallId,
        showCall: {
          editionId,
        },
      },
    })

    if (!application) {
      throw createError({
        status: 404,
        message: 'Candidature non trouvée',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = showApplicationStatusSchema.parse(body)

    // Préparer les données de mise à jour
    const updateData: Prisma.ShowApplicationUpdateInput = {
      status: validatedData.status,
    }

    // Si le statut change vers ACCEPTED ou REJECTED, enregistrer qui a pris la décision
    if (
      validatedData.status !== application.status &&
      (validatedData.status === 'ACCEPTED' || validatedData.status === 'REJECTED')
    ) {
      updateData.decidedAt = new Date()
      updateData.decidedById = user.id
    }

    // Si on repasse en PENDING, effacer les informations de décision
    if (validatedData.status === 'PENDING') {
      updateData.decidedAt = null
      updateData.decidedById = null
    }

    // Mettre à jour les notes organisateur si fournies
    if (validatedData.organizerNotes !== undefined) {
      updateData.organizerNotes = validatedData.organizerNotes
    }

    // Mettre à jour la candidature
    const updatedApplication = await prisma.showApplication.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        showCall: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            emailHash: true,
            profilePicture: true,
          },
        },
        decidedBy: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
          },
        },
      },
    })

    // Notifier l'artiste si le statut change vers ACCEPTED ou REJECTED
    if (validatedData.status !== application.status) {
      const editionData = await prisma.edition.findUnique({
        where: { id: editionId },
        select: { name: true },
      })
      const editionName = editionData?.name || ''

      if (validatedData.status === 'ACCEPTED') {
        await safeNotify(
          () =>
            NotificationHelpers.showApplicationAccepted(
              application.userId,
              application.showTitle,
              editionName,
              editionId
            ),
          'candidature artiste acceptée'
        )
      } else if (validatedData.status === 'REJECTED') {
        await safeNotify(
          () =>
            NotificationHelpers.showApplicationRejected(
              application.userId,
              application.showTitle,
              editionName,
              editionId
            ),
          'candidature artiste refusée'
        )
      }
    }

    return {
      success: true,
      application: updatedApplication,
    }
  },
  { operationName: 'UpdateShowCallApplicationStatus' }
)
