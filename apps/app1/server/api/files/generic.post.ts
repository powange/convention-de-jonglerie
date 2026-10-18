import type { ServerFile } from 'nuxt-file-storage'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { uploadRateLimiter } from '#server/utils/api-rate-limiter'
import { validateUploadedFile } from '#server/utils/upload-validation'

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
    await requireGlobalAdminWithDbCheck(event)

    /*
     * Le même limiteur que les sept autres points d'envoi, bien que celui-ci soit réservé aux
     * administrateurs globaux. L'uniformité est le but : c'est elle que le test de garde vérifie,
     * et une exception — même défendable — serait le trou par lequel la règle se perd.
     */
    await uploadRateLimiter(event)

    const { files, metadata } = await readBody<RequestBody>(event)

    /*
     * ⚠️ On teste L'ÉLÉMENT, pas la longueur. `files.length === 0` garantit bien son existence à
     * l'exécution, mais TypeScript ne propage rien depuis un test sur `.length` : `files[0]`
     * restait `ServerFile | undefined` et les appels suivants étaient en erreur `TS2345`.
     * Vérifier directement l'élément narrowe ET remplace deux gardes par une.
     */
    const file = files?.[0]
    if (!file) {
      throw createError({
        status: 400,
        message: 'Aucun fichier fourni',
      })
    }

    validateUploadedFile(file)
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

    return createSuccessResponse({
      imageUrl,
      filename,
      temporary: !entityId,
    })
  },
  { operationName: 'UploadGenericFile' }
)
