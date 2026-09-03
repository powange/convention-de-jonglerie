import type { ServerFile } from 'nuxt-file-storage'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateUploadedFile } from '#server/utils/upload-validation'

/**
 * Envoi du justificatif d'une entrée de trésorerie — photo d'un ticket de caisse ou d'une facture.
 *
 * Le droit exigé est celui de la trésorerie, et non le droit général de modifier l'édition : les
 * comptes ont leur propre autorisation, et un organisateur qui n'y a pas accès ne doit pas
 * pouvoir y déposer de pièce.
 */
interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
    entityId?: number
    editionId?: number
  }
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { files, metadata } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({ status: 400, message: 'Aucun fichier fourni' })
    }

    const file = files[0]
    validateUploadedFile(file)

    const targetEditionId = metadata.entityId || metadata.editionId
    if (!targetEditionId) {
      throw createError({ status: 400, message: "ID d'édition requis pour la trésorerie" })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: targetEditionId },
      select: { id: true, conventionId: true },
    })

    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const allowed = await canManageTreasuryById(targetEditionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    // Dépôt temporaire, comme pour l'affiche d'une édition ou l'image d'un spectacle : tant que
    // l'entrée n'est pas enregistrée, rien ne doit atterrir dans son dossier définitif. Le
    // déplacement se fait à l'enregistrement.
    const dossier = `temp/treasury/${targetEditionId}`
    const filename = await storeFileLocally(file, 8, dossier)

    return createSuccessResponse({
      imageUrl: `/uploads/${dossier}/${filename}`,
      filename,
      editionId: targetEditionId,
      conventionId: edition.conventionId,
    })
  },
  { operationName: 'UploadTreasuryFile' }
)
