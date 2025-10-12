import { requireGlobalAdmin } from '../../utils/auth-utils'

import type { ServerFile } from 'nuxt-file-storage'

interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
    entityId?: number
  }
}

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et que l'utilisateur est admin global
  requireGlobalAdmin(event)

  try {
    const { files, metadata } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun fichier fourni',
      })
    }

    const file = files[0] // Prendre le premier fichier
    const { entityId } = metadata

    // Stocker le fichier dans un dossier générique ou temporaire
    const destinationPath = entityId ? `generic/${entityId}` : 'temp'

    const filename = await storeFileLocally(
      file,
      8, // longueur ID unique
      destinationPath // dossier de destination dans public
    )

    // Construire l'URL publique
    const imageUrl = entityId
      ? `/uploads/generic/${entityId}/${filename}`
      : `/uploads/temp/${filename}`

    return {
      success: true,
      imageUrl,
      filename,
      temporary: !entityId,
    }
  } catch (error: unknown) {
    console.error("Erreur lors de l'upload générique:", error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'upload de l'image",
    })
  }
})
