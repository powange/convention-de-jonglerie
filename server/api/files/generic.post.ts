import type { ServerFile } from 'nuxt-file-storage'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireGlobalAdmin } from '#server/utils/auth-utils'

interface RequestBody {
  files: ServerFile[]
  metadata: {
    endpoint: string
    entityId?: number
  }
}

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et que l'utilisateur est admin global
    requireGlobalAdmin(event)

    const { files, metadata } = await readBody<RequestBody>(event)

    if (!files || files.length === 0) {
      throw createError({
        status: 400,
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
  },
  { operationName: 'UploadGenericFile' }
)
