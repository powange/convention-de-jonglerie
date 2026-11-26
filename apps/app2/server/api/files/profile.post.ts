import { validateUploadedFile } from '../../../../../layers/core/server/socle/upload-validation'
import { dossierTemporaire } from '../../utils/photo-de-profil'
import { uploadRateLimiter } from '../../utils/rate-limiter'

/**
 * Dépôt TEMPORAIRE d'une photo de profil — même contrat qu'app1 (`apps/app1/server/api/files/
 * profile.post.ts`), puisque c'est le même composant `UiImageUpload` qui l'appelle :
 * `{ files: [ServerFile], metadata }` en JSON (image en base64) → `{ data: { imageUrl } }`.
 *
 * Seulement pour soi : pas de dépôt pour un autre compte (app1 le permet à un administrateur).
 * La photo ne devient définitive qu'à l'enregistrement du profil (PUT /api/profile/update) ; un
 * dépôt abandonné est effacé au bout d'une heure par la tâche `cleanup-temp-uploads`.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = (user as { id: number }).id
  await uploadRateLimiter(event)

  const body = await readBody(event)
  const fichier = Array.isArray(body?.files) ? body.files[0] : null
  if (!fichier) throw createError({ status: 400, message: 'Aucun fichier fourni' })

  // Les formats que la route /uploads sert pour une photo, et 5 Mo comme le composant côté client.
  validateUploadedFile(fichier, {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    maxSizeBytes: 5 * 1024 * 1024,
  })
  const nom = await storeFileLocally(fichier, 8, dossierTemporaire(id))

  return createSuccessResponse(
    { imageUrl: `/uploads/${dossierTemporaire(id)}/${nom}` },
    'Photo déposée'
  )
})
