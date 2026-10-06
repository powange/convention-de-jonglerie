import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import {
  ALLOWED_RECEIPT_EXTENSIONS,
  ALLOWED_RECEIPT_MIME_TYPES,
  validateUploadedFile,
} from '#server/utils/upload-validation'

/** Même forme de corps que son voisin `treasury`, pour la même raison : un corps mal formé vaut 400. */
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
 * Dépôt d'un justificatif d'ARTISTE : billet de train, facture d'essence, péage, consommables.
 *
 * ## Pourquoi un point d'API distinct de celui de la trésorerie
 *
 * ⚠️ LE DROIT N'EST PAS LE MÊME, et c'est la seule raison d'être de ce fichier. `files/treasury`
 * exige `canManageTreasuryById` : un organisateur qui gère les artistes sans avoir accès aux
 * comptes s'y verrait refuser, au moment précis où il saisit le défraiement qu'il vient de régler.
 * Réutiliser ce point aurait donc fermé la fonctionnalité à ceux à qui elle s'adresse.
 *
 * 📍 TOUT LE RESTE EST PARTAGÉ : la validation du fichier, le dépôt temporaire, et surtout le
 * déplacement à l'enregistrement (`deplacerJustificatif`, domaine `artists`), qui porte les gardes
 * contre la traversée de répertoire. Ce fichier ne recopie que l'enveloppe.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const analyse = bodySchema.safeParse(await readBody(event))
    if (!analyse.success) {
      throw createError({
        status: 400,
        message: `Dépôt invalide : ${analyse.error.issues[0]?.message ?? 'corps mal formé'}`,
      })
    }
    const { files, metadata } = analyse.data

    const file = files[0] as Parameters<typeof validateUploadedFile>[0]
    // Le PDF est accepté en plus des images : beaucoup de billets de train n'existent que sous
    // cette forme, et il faudrait sinon en faire une capture d'écran.
    validateUploadedFile(file, {
      allowedMimeTypes: ALLOWED_RECEIPT_MIME_TYPES,
      allowedExtensions: ALLOWED_RECEIPT_EXTENSIONS,
    })

    const targetEditionId = metadata?.entityId || metadata?.editionId
    if (!targetEditionId) {
      throw createError({ status: 400, message: "ID d'édition requis" })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: targetEditionId },
      select: { id: true, conventionId: true },
    })

    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const allowed = await canManageArtistsById(targetEditionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer les artistes' })
    }

    /*
     * Dépôt TEMPORAIRE : tant que la fiche de l'artiste n'est pas enregistrée, rien ne doit
     * atterrir dans son dossier définitif. Un justificatif choisi puis abandonné reste ainsi dans
     * `temp/`, isolé et purgeable en bloc.
     *
     * ⚠️ Le dossier porte le domaine `artists` : c'est lui que `deplacerJustificatif` exigera à
     * l'enregistrement, et c'est ce qui empêche d'enregistrer sur un artiste l'URL d'une pièce
     * comptable de la même édition.
     */
    const dossier = `temp/artists/${targetEditionId}`
    const filename = await storeFileLocally(file, 8, dossier)

    return createSuccessResponse({
      imageUrl: `/uploads/${dossier}/${filename}`,
      filename,
      editionId: targetEditionId,
      conventionId: edition.conventionId,
    })
  },
  { operationName: 'POST artist receipt file' }
)
