import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateUploadedFile } from '#server/utils/upload-validation'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation basique
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      throw createError({
        status: 400,
        message: 'Aucun fichier fourni',
      })
    }

    // Récupérer l'ID utilisateur depuis les métadonnées ou utiliser l'utilisateur connecté par défaut
    const targetUserId = body.metadata?.entityId || user.id

    // Vérification de sécurité : seuls les admins peuvent uploader pour d'autres utilisateurs
    if (targetUserId !== user.id) {
      // Vérifier que l'utilisateur connecté est un admin
      const { prisma } = await import('#server/utils/prisma')
      const currentUser = await fetchResourceOrFail<{ isGlobalAdmin: boolean }>(
        prisma.user,
        user.id,
        {
          select: { isGlobalAdmin: true },
          errorMessage: 'Utilisateur introuvable',
        }
      )

      if (!currentUser.isGlobalAdmin) {
        throw createError({
          status: 403,
          message: "Accès refusé - Droits administrateur requis pour modifier d'autres profils",
        })
      }
    }

    // Stocker les fichiers dans le dossier temporaire pour le profil
    const results = []

    for (const file of body.files) {
      try {
        // Validation MIME type, extension et taille
        validateUploadedFile(file)

        // Utiliser nuxt-file-storage pour stocker le fichier dans temp/profiles/[targetUserId]
        const storedFilename = await storeFileLocally(
          file,
          8, // Longueur du suffixe aléatoire
          `temp/profiles/${targetUserId}` // Dossier temporaire pour ce profil
        )

        // Construire l'URL temporaire
        const temporaryUrl = `/uploads/temp/profiles/${targetUserId}/${storedFilename}`

        results.push({
          success: true,
          filename: storedFilename,
          temporaryUrl,
          originalName: file.name,
        })
      } catch (error) {
        console.error(`Erreur lors du stockage de ${file.name}:`, error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          filename: file.name,
        })
      }
    }

    // Si au moins un fichier a été uploadé avec succès
    const successfulUploads = results.filter((r) => r.success)
    if (successfulUploads.length > 0) {
      // Pour l'instant, retourner l'URL du premier fichier (profils ont une seule image)
      const firstUpload = successfulUploads[0]

      return createSuccessResponse({
        imageUrl: firstUpload.temporaryUrl,
        results,
      })
    } else {
      throw createError({
        status: 500,
        message: "Échec de l'upload de tous les fichiers",
      })
    }
  },
  { operationName: 'UploadProfileFile' }
)
