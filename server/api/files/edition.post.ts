import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

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

    if (!body.metadata?.entityId) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition requis",
      })
    }

    const entityId = body.metadata.entityId
    let editionId: number | null = null
    let isNewEdition = false

    if (entityId === 'NEW_EDITION') {
      // Nouvelle édition - utiliser placeholder
      isNewEdition = true
    } else {
      // Édition existante - valider l'ID
      editionId = parseInt(entityId)
      if (isNaN(editionId)) {
        throw createError({
          statusCode: 400,
          message: "ID d'édition invalide",
        })
      }
    }

    if (!isNewEdition) {
      // Pour les éditions existantes, vérifier les permissions
      const edition = await prisma.edition.findUnique({
        where: { id: editionId! },
        include: {
          convention: {
            include: {
              organizers: true,
            },
          },
        },
      })

      if (!edition) {
        throw createError({
          statusCode: 404,
          message: 'Édition introuvable',
        })
      }

      if (!canEditEdition(edition, user)) {
        throw createError({
          statusCode: 403,
          message: "Vous n'avez pas les droits pour modifier cette édition",
        })
      }
    }
    // Pour les nouvelles éditions (isNewEdition = true), on laisse passer

    console.log('=== UPLOAD EDITION FILES ===')
    console.log('Edition ID:', editionId)
    console.log('Files count:', body.files.length)

    // Stocker les fichiers dans le dossier temporaire pour les éditions
    const results = []
    const storageId = isNewEdition ? 'NEW_EDITION' : editionId

    for (const file of body.files) {
      console.log(`Stockage fichier: ${file.name}`)

      try {
        // Utiliser nuxt-file-storage pour stocker le fichier dans temp/editions/[id]
        const storedFilename = await storeFileLocally(
          file,
          8, // Longueur du suffixe aléatoire
          `temp/editions/${storageId}` // Dossier temporaire pour cette édition
        )

        console.log(`Fichier stocké: ${storedFilename}`)

        // Construire l'URL temporaire
        const temporaryUrl = `/uploads/temp/editions/${storageId}/${storedFilename}`

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
  },
  { operationName: 'UploadEditionFile' }
)
