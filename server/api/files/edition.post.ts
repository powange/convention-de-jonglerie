import { prisma } from '../../utils/prisma'

import type { ServerFile } from 'nuxt-file-storage'

interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
    entityId?: number
    editionId?: number
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

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    const { entityId, editionId } = metadata

    // Si c'est pour une édition existante, vérifier les permissions
    if (entityId || editionId) {
      const targetId = entityId || editionId
      const edition = await prisma.edition.findUnique({
        where: { id: targetId },
        include: {
          convention: true,
        },
      })

      if (!edition) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Édition introuvable',
        })
      }

      // Vérifier les droits (créateur de l'édition ou auteur de la convention)
      const hasPermission =
        edition.creatorId === event.context.user.id ||
        edition.convention.authorId === event.context.user.id

      if (!hasPermission) {
        throw createError({
          statusCode: 403,
          statusMessage: "Vous n'avez pas les droits pour modifier cette édition",
        })
      }

      // Stocker le fichier dans le dossier de l'édition (sous conventions)
      const filename = await storeFileLocally(
        file,
        8, // longueur ID unique
        `conventions/${edition.conventionId}/editions/${targetId}` // dossier de destination dans le mount
      )

      // Mettre à jour l'édition avec la nouvelle URL
      const imageUrl = `/uploads/conventions/${edition.conventionId}/editions/${targetId}/${filename}`

      const updatedEdition = await prisma.edition.update({
        where: { id: targetId },
        data: { imageUrl },
        include: {
          creator: { select: { id: true, email: true, pseudo: true } },
          convention: true,
          favoritedBy: { select: { id: true } },
        },
      })

      return {
        success: true,
        imageUrl,
        filename,
        edition: updatedEdition,
      }
    } else {
      // Nouvelle édition - stocker temporairement
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
    console.error("Erreur lors de l'upload d'édition:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'upload de l'image",
    })
  }
})
