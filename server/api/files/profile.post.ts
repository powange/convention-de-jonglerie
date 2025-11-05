import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation basique
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun fichier fourni',
      })
    }

    // Récupérer l'ID utilisateur depuis les métadonnées ou utiliser l'utilisateur connecté par défaut
    const targetUserId = body.metadata?.entityId || user.id

    // Vérification de sécurité : seuls les admins peuvent uploader pour d'autres utilisateurs
    if (targetUserId !== user.id) {
      // Vérifier que l'utilisateur connecté est un admin
      const { prisma } = await import('@@/server/utils/prisma')
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
          statusCode: 403,
          message: "Accès refusé - Droits administrateur requis pour modifier d'autres profils",
        })
      }
    }

    console.log('=== UPLOAD PROFILE FILES ===')
    console.log('Connected user ID:', user.id)
    console.log('Target user ID:', targetUserId)
    console.log('Files count:', body.files.length)

    // Stocker les fichiers dans le dossier temporaire pour le profil
    const results = []

    for (const file of body.files) {
      console.log(`Stockage fichier: ${file.name}`)
      console.log('File object keys:', Object.keys(file))
      console.log('File content available:', !!file.content)
      console.log('File content type:', typeof file.content)
      console.log('File content length:', file.content?.length || 0)

      try {
        // Vérifier que le fichier a du contenu
        if (!file.content) {
          throw new Error('Fichier sans contenu')
        }

        // Utiliser nuxt-file-storage pour stocker le fichier dans temp/profiles/[targetUserId]
        const storedFilename = await storeFileLocally(
          file,
          8, // Longueur du suffixe aléatoire
          `temp/profiles/${targetUserId}` // Dossier temporaire pour ce profil
        )

        console.log(`Fichier stocké: ${storedFilename}`)

        // Vérifier que le fichier a été réellement créé
        const storedPath = getFileLocally(`temp/profiles/${targetUserId}/${storedFilename}`)
        console.log(`Chemin du fichier stocké: ${storedPath}`)
        console.log(`Fichier existe: ${!!storedPath}`)

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

      console.log('=== UPLOAD PROFILE SUCCESS ===')
      console.log('Temporary URL:', firstUpload.temporaryUrl)

      return {
        success: true,
        imageUrl: firstUpload.temporaryUrl,
        results,
      }
    } else {
      throw createError({
        statusCode: 500,
        message: "Échec de l'upload de tous les fichiers",
      })
    }
  },
  { operationName: 'UploadProfileFile' }
)
