import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtists } from '#server/utils/permissions/edition-permissions'
import { validateUploadedFile } from '#server/utils/upload-validation'

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

    /*
     * ⚠️ `canManageArtists` ET NON `canEditEdition`, pour que DÉPOSER une affiche demande le même
     * droit que CRÉER le spectacle qu'elle illustre.
     *
     * Créer ou modifier un spectacle exige `canManageArtists` (`shows/index.post.ts`). Téléverser
     * son affiche exigeait `canEditEdition`, qui ne couvre que créateur, auteur, `editAllEditions`
     * et l'admin — PAS `canManageArtists`. Un organisateur à qui l'on a délégué les seuls artistes
     * pouvait donc créer le spectacle, puis recevoir 403 au moment d'ajouter l'image. La moitié
     * d'un geste autorisée, l'autre refusée.
     *
     * Le chargement de l'édition convient déjà : `canManageArtists` attend `convention.organizers`
     * et `organizerPermissions.organizer`, que cette requête inclut.
     */
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour modifier les spectacles de cette édition",
      })
    }

    const results = []

    for (const file of body.files) {
      try {
        validateUploadedFile(file)
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
