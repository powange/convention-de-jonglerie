/**
 * Affiche d'un événement Flowvent : même circuit que la photo de profil (photo-de-profil.ts).
 *
 * 1. L'image est déposée dans `temp/events/<id>/` (POST /api/files/edition), et le formulaire n'en
 *    garde que l'URL temporaire.
 * 2. À l'enregistrement des informations de l'événement, elle passe dans `events/<id>/` ; la base
 *    garde le chemin PUBLIC (`/uploads/events/<id>/<fichier>`), que la page publique affiche tel
 *    quel. L'ancienne affiche est effacée après le stockage de la nouvelle, jamais avant.
 *
 * Un dépôt abandonné est effacé au bout d'une heure par la tâche `cleanup-temp-uploads`.
 */
import { readFile } from 'node:fs/promises'

export const dossierTemporaireAffiche = (eventId: number) => `temp/events/${eventId}`
export const dossierAffiche = (eventId: number) => `events/${eventId}`

/** Un nom de fichier de NOTRE stockage : ni URL, ni remontée de dossier. */
function nomSur(valeur: string): boolean {
  return !!valeur && !valeur.includes('://') && !valeur.includes('..') && !valeur.includes('/')
}

/** Le nom de fichier d'une URL `/uploads/<dossier>/<nom>`, ou `null` si elle n'en vient pas. */
function nomDans(url: string | null | undefined, dossier: string): string | null {
  const prefixe = `/uploads/${dossier}/`
  if (!url?.startsWith(prefixe)) return null
  const nom = url.slice(prefixe.length)
  return nomSur(nom) ? nom : null
}

async function effacerAffiche(url: string | null | undefined, eventId: number) {
  const nom = nomDans(url, dossierAffiche(eventId))
  if (!nom) return
  try {
    await deleteFile(nom, dossierAffiche(eventId))
  } catch (erreur) {
    console.warn(`[affiche] ancienne affiche non effacée (${nom}) :`, erreur)
  }
}

/**
 * Ce que l'enregistrement doit écrire dans `imageUrl` :
 * - `undefined` : pas de changement demandé ;
 * - `null` : retrait — l'ancienne affiche est effacée ;
 * - la valeur déjà en base : inchangée ;
 * - une URL temporaire de CET événement : rendue définitive, puis l'ancienne effacée.
 * Toute autre valeur est refusée : on n'enregistre pas une URL arbitraire comme affiche.
 */
export async function afficheAEnregistrer(
  demandee: string | null | undefined,
  actuelle: string | null,
  eventId: number
): Promise<string | null | undefined> {
  if (demandee === undefined) return undefined
  if (demandee === null || demandee === '') {
    await effacerAffiche(actuelle, eventId)
    return null
  }
  if (demandee === actuelle) return actuelle

  const nom = nomDans(demandee, dossierTemporaireAffiche(eventId))
  if (!nom) throw createError({ status: 400, message: 'Affiche déposée invalide' })
  const contenu = await readFile(getFileLocally(nom, dossierTemporaireAffiche(eventId))).catch(
    () => null
  )
  if (!contenu) {
    throw createError({ status: 400, message: 'Affiche déposée introuvable, déposez-la à nouveau' })
  }
  const definitif = await storeFileLocally(
    {
      name: nom,
      // L'extension vient du nom : le type MIME de l'URL de données n'est pas relu.
      content: `data:application/octet-stream;base64,${contenu.toString('base64')}`,
      size: String(contenu.length),
      type: 'application/octet-stream',
      lastModified: String(Date.now()),
    },
    8,
    dossierAffiche(eventId)
  )
  await deleteFile(nom, dossierTemporaireAffiche(eventId)).catch(() => {})
  await effacerAffiche(actuelle, eventId)
  return `/uploads/${dossierAffiche(eventId)}/${definitif}`
}
