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

    if (!body.metadata?.entityId) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition requis",
      })
    }

    const editionId = parseInt(body.metadata.entityId)
    if (isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition invalide",
      })
    }

    console.log('=== UPLOAD EDITION FILES ===')
    console.log('Edition ID:', editionId)
    console.log('Files count:', body.files.length)

    // Stocker les fichiers dans le dossier temporaire pour les éditions
    const results = []

    for (const file of body.files) {
      console.log(`Stockage fichier: ${file.name}`)

      try {
        // Utiliser nuxt-file-storage pour stocker le fichier dans temp/editions/[id]
        const storedFilename = await storeFileLocally(
          file,
          8, // Longueur du suffixe aléatoire
          `temp/editions/${editionId}` // Dossier temporaire pour cette édition
        )

        console.log(`Fichier stocké: ${storedFilename}`)

        // Construire l'URL temporaire
        const temporaryUrl = `/uploads/temp/editions/${editionId}/${storedFilename}`

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
      // Pour l'instant, retourner l'URL du premier fichier (éditions ont une seule image)
      const firstUpload = successfulUploads[0]

      console.log('=== UPLOAD EDITION SUCCESS ===')
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
    console.error("Erreur dans l'upload d'édition:", error)

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
