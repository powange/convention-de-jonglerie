import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      throw createError({
        status: 400,
        message: 'Aucun fichier fourni',
      })
    }

    if (!body.metadata?.entityId) {
      throw createError({
        status: 400,
        message: "ID d'édition requis",
      })
    }

    const editionId = parseInt(body.metadata.entityId)
    if (isNaN(editionId)) {
      throw createError({
        status: 400,
        message: "ID d'édition invalide",
      })
    }

    // Vérifier les permissions sur l'édition
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: true,
          },
        },
        organizerPermissions: {
          include: {
            organizer: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition introuvable',
      })
    }

    if (!canEditEdition(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour modifier les spectacles de cette édition",
      })
    }

    const results = []

    for (const file of body.files) {
      try {
        const storedFilename = await storeFileLocally(file, 8, `temp/shows/${editionId}`)

        const temporaryUrl = `/uploads/temp/shows/${editionId}/${storedFilename}`

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

    const successfulUploads = results.filter((r) => r.success)
    if (successfulUploads.length > 0) {
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
  { operationName: 'UploadShowFile' }
)
