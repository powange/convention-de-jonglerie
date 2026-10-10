import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { uploadRateLimiter } from '#server/utils/api-rate-limiter'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  ALLOWED_RECEIPT_EXTENSIONS,
  ALLOWED_RECEIPT_MIME_TYPES,
  validateUploadedFile,
} from '#server/utils/upload-validation'

/**
 * Le corps était lu sans validation, et `metadata.entityId` levait un `TypeError` — donc un 500 —
 * dès que `metadata` manquait. Un corps mal formé est une erreur du client : il mérite un 400 qui
 * dit quoi, pas une panne serveur.
 *
 * `metadata` est optionnel ici, et son absence retombe sur le contrôle d'identifiant existant, qui
 * rend déjà un 400 explicite. Les identifiants sont acceptés en nombre comme en chaîne : le client
 * les transmet tels que l'URL les porte.
 *
 * Trois voisins de ce dossier — `convention`, `generic` et `lost-found` — déstructurent `metadata`
 * de la même façon et tombent donc sur le même 500. `edition`, `show` et `profile`, eux, passent
 * déjà par `metadata?.`. Rien n'est touché ici : chacun a sa propre forme de corps.
 */
const identifiant = z.coerce.number().int().positive().optional()

const bodySchema = z.object({
  files: z.array(z.unknown()).min(1, 'Aucun fichier fourni'),
  metadata: z
    .object({
      endpoint: z.string().optional(),
      entityId: identifiant,
      editionId: identifiant,
    })
    .optional(),
})

/**
 * Envoi du justificatif d'une entrée de trésorerie — photo d'un ticket de caisse ou d'une facture.
 *
 * Le droit exigé est celui de la trésorerie, et non le droit général de modifier l'édition : les
 * comptes ont leur propre autorisation, et un organisateur qui n'y a pas accès ne doit pas
 * pouvoir y déposer de pièce.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Borne le débit d'envoi, par COMPTE : appelé après `requireAuth`, pour que la clé soit un
    // utilisateur réel et non le seau commun des anonymes.
    await uploadRateLimiter(event)

    const analyse = bodySchema.safeParse(await readBody(event))
    if (!analyse.success) {
      throw createError({
        status: 400,
        message: `Dépôt invalide : ${analyse.error.issues[0]?.message ?? 'corps mal formé'}`,
      })
    }
    const { files, metadata } = analyse.data

    const file = files[0] as Parameters<typeof validateUploadedFile>[0]
    // Un justificatif accepte le PDF en plus des images : beaucoup de factures n'existent que sous
    // cette forme.
    validateUploadedFile(file, {
      allowedMimeTypes: ALLOWED_RECEIPT_MIME_TYPES,
      allowedExtensions: ALLOWED_RECEIPT_EXTENSIONS,
    })

    const targetEditionId = metadata?.entityId || metadata?.editionId
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
