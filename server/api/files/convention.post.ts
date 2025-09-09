import { prisma } from '../../utils/prisma'

interface RequestBody {
  files: any[]
  metadata: {
    endpoint: string
    entityId?: number
    conventionId?: number
  }
}

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  try {
    const { files, metadata } = await readBody<RequestBody>(event)

    console.log('Received files:', files)
    console.log('Metadata:', metadata)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    console.log('Processing file:', file.name, 'type:', file.type)
    const { entityId, conventionId } = metadata

    // Si c'est pour une convention existante, vérifier les permissions
    if (entityId || conventionId) {
      const targetId = entityId || conventionId
      const convention = await prisma.convention.findUnique({
        where: { id: targetId },
        include: {
          collaborators: {
            where: {
              userId: event.context.user.id,
              canEditConvention: true,
            },
          },
        },
      })

      if (!convention) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Convention introuvable',
        })
      }

      const isAuthor = convention.authorId === event.context.user.id
      const isCollaborator = convention.collaborators.length > 0
      const isGlobalAdmin = event.context.user.isGlobalAdmin || false

      if (!isAuthor && !isCollaborator && !isGlobalAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: "Vous n'avez pas les droits pour modifier cette convention",
        })
      }

      // Stocker le fichier dans le dossier temporaire pour conventions existantes
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        `temp/conventions/${targetId}` // dossier temporaire spécifique à la convention
      )

      // Retourner l'URL temporaire - la DB ne sera mise à jour qu'au PUT
      const imageUrl = `/uploads/temp/conventions/${targetId}/${filename}`

      console.log('=== UPLOAD CONVENTION ===')
      console.log('Fichier stocké:', filename)
      console.log('URL retournée:', imageUrl)
      console.log('Convention ID:', targetId)

      return {
        success: true,
        imageUrl,
        filename, // Le nom de fichier sera stocké en DB lors du PUT
        temporary: true,
        conventionId: targetId,
      }
    } else {
      // Nouvelle convention - stocker temporairement
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        'temp' // dossier temporaire dans le mount
      )

      const imageUrl = `/uploads/temp/${filename}`

      return {
        success: true,
        imageUrl,
        filename,
        temporary: true,
      }
    }
  } catch (error: unknown) {
    console.error("Erreur lors de l'upload de convention:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'upload de l'image",
    })
  }
})
