import { validateUploadedFile } from '../../../../../layers/core/server/socle/upload-validation'
import { dossierTemporaireAffiche } from '../../utils/affiche-evenement'
import { droitsSurEvenement } from '../../utils/droits-evenement'
import { uploadRateLimiter } from '../../utils/rate-limiter'

/**
 * Dépôt TEMPORAIRE de l'affiche d'un événement — contrat du composant `UiImageUpload` (type
 * `edition`) : `{ files: [ServerFile], metadata: { entityId } }` en JSON (image en base64) →
 * `{ data: { imageUrl } }`. `entityId` est l'id numérique de l'événement.
 *
 * Réservé à qui peut modifier l'événement. L'affiche ne devient définitive qu'à l'enregistrement
 * des informations (PUT /api/events/:id, affiche-evenement.ts) ; un dépôt abandonné est effacé au
 * bout d'une heure par la tâche `cleanup-temp-uploads`.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  await uploadRateLimiter(event)
  const body = await readBody(event)
  const eventId = Number(body?.metadata?.entityId)
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw createError({ status: 400, message: 'Événement manquant' })
  }
  const droits = await droitsSurEvenement(eventId, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.modifier) {
    throw createError({ status: 403, message: 'Vous ne pouvez pas modifier cet événement' })
  }
  const fichier = Array.isArray(body?.files) ? body.files[0] : null
  if (!fichier) throw createError({ status: 400, message: 'Aucun fichier fourni' })
  // Les formats que la route /uploads sert pour une image, et 5 Mo comme le composant client.
  validateUploadedFile(fichier, {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    maxSizeBytes: 5 * 1024 * 1024,
  })
  const nom = await storeFileLocally(fichier, 8, dossierTemporaireAffiche(eventId))
  return createSuccessResponse(
    { imageUrl: `/uploads/${dossierTemporaireAffiche(eventId)}/${nom}` },
    'Affiche déposée'
  )
})
