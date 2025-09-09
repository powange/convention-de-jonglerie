export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  try {
    const body = await readBody(event)

    // Validation basique
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun fichier fourni',
      })
    }

    const userId = event.context.user.id

    console.log('=== UPLOAD PROFILE FILES ===')
    console.log('User ID:', userId)
    console.log('Files count:', body.files.length)

    // Stocker les fichiers dans le dossier temporaire pour le profil
    const results = []

    for (const file of body.files) {
      console.log(`Stockage fichier: ${file.name}`)

      try {
        // Utiliser nuxt-file-storage pour stocker le fichier dans temp/profiles/[userId]
        const storedFilename = await storeFileLocally(
          file,
          8, // Longueur du suffixe aléatoire
          `temp/profiles/${userId}` // Dossier temporaire pour ce profil
        )

        console.log(`Fichier stocké: ${storedFilename}`)

        // Construire l'URL temporaire
        const temporaryUrl = `/uploads/temp/profiles/${userId}/${storedFilename}`

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
  } catch (error) {
    console.error("Erreur dans l'upload de profil:", error)

    // Si c'est déjà une erreur HTTP, la relancer
    if ((error as any)?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur serveur lors de l'upload",
    })
  }
})
