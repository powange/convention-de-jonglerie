import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { uploadRateLimiter } from '#server/utils/api-rate-limiter'
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
 *
 * ## Deux appelants
 *
 * Les organisateurs qui gèrent les artistes, ET **l'artiste lui-même** depuis son espace, pour les
 * justificatifs de son propre défraiement. Voir la garde plus bas : elle les admet tous les deux,
 * en un seul endroit.
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

    /*
     * Deux sortes d'appelants, une seule garde.
     *
     * ⚠️ L'ARTISTE DÉPOSE SES PROPRES JUSTIFICATIFS depuis son espace : c'est lui qui a le billet
     * de train en main, et le lui faire envoyer par courriel à un organisateur pour qu'il le
     * reverse ici était un détour que rien ne justifiait.
     *
     * 📍 Déposer ne donne RIEN DE PLUS que déposer : le fichier atterrit dans `temp/`, et c'est
     * l'enregistrement qui décide sur quelle fiche il s'attache. Un artiste ne peut écrire que la
     * sienne — `my-payment-info.put.ts` résout sa fiche par `editionId_userId`, jamais par un
     * identifiant reçu.
     */
    const estGestionnaire = await canManageArtistsById(targetEditionId, user.id, event)
    const estArtisteDeLEdition =
      estGestionnaire ||
      (await prisma.editionArtist.findUnique({
        where: { editionId_userId: { editionId: targetEditionId, userId: user.id } },
        select: { id: true },
      })) !== null

    if (!estArtisteDeLEdition) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour déposer un justificatif sur cette édition',
      })
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
