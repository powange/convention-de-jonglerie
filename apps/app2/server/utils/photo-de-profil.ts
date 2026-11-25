/**
 * Photo de profil de Flowvent : même circuit qu'app1 (apps/app1/server/api/profile/update.put.ts).
 *
 * 1. L'image est déposée dans `temp/profiles/<id>/` (POST /api/files/profile), et l'interface
 *    n'en garde que l'URL temporaire.
 * 2. À l'enregistrement du profil, elle passe dans `profiles/<id>/` ; la base ne garde que le NOM
 *    du fichier, et l'ancienne photo est effacée — après le stockage de la nouvelle, jamais avant.
 *
 * Une photo reprise de Google ou Facebook est une URL absolue : elle n'est pas sur notre disque et
 * ne s'efface pas.
 */
import { readFile } from 'node:fs/promises'

export const dossierTemporaire = (userId: number) => `temp/profiles/${userId}`
export const dossierDefinitif = (userId: number) => `profiles/${userId}`

/** Un nom de fichier de NOTRE stockage : ni URL, ni remontée de dossier. */
function estUnFichierDeNotreStockage(valeur: string | null | undefined): valeur is string {
  return !!valeur && !valeur.includes('://') && !valeur.includes('..') && !valeur.includes('/')
}

/** Efface l'ancienne photo du disque. N'échoue jamais : un fichier orphelin vaut mieux qu'un refus. */
export async function effacerAnciennePhoto(nom: string | null | undefined, userId: number) {
  if (!estUnFichierDeNotreStockage(nom)) return
  try {
    await deleteFile(nom, dossierDefinitif(userId))
  } catch (erreur) {
    console.warn(`[photo de profil] ancienne photo non effacée (${nom}) :`, erreur)
  }
}

/** Déplace une photo déposée (URL `/uploads/temp/profiles/<id>/<fichier>`) dans le dossier définitif. */
async function rendreDefinitive(urlTemporaire: string, userId: number): Promise<string> {
  const prefixe = `/uploads/${dossierTemporaire(userId)}/`
  const nom = urlTemporaire.startsWith(prefixe) ? urlTemporaire.slice(prefixe.length) : ''
  if (!estUnFichierDeNotreStockage(nom)) {
    throw createError({ status: 400, message: 'Photo déposée invalide' })
  }
  const chemin = getFileLocally(nom, dossierTemporaire(userId))
  const contenu = await readFile(chemin).catch(() => null)
  if (!contenu) {
    throw createError({ status: 400, message: 'Photo déposée introuvable, déposez-la à nouveau' })
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
    dossierDefinitif(userId)
  )
  await deleteFile(nom, dossierTemporaire(userId)).catch(() => {})
  return definitif
}

/**
 * Ce que l'enregistrement du profil doit écrire dans `profilePicture`.
 *
 * - `undefined` : pas de changement demandé ;
 * - `null` : retrait — l'ancienne photo est effacée ;
 * - une URL temporaire : nouvelle photo, rendue définitive, puis l'ancienne effacée ;
 * - la valeur déjà en base (nom de fichier ou URL Google/Facebook) : inchangée.
 *
 * Toute autre valeur est refusée : on n'enregistre pas une URL arbitraire comme photo.
 */
export async function photoAEnregistrer(
  demandee: string | null | undefined,
  actuelle: string | null,
  userId: number
): Promise<string | null | undefined> {
  if (demandee === undefined) return undefined
  if (demandee === null) {
    await effacerAnciennePhoto(actuelle, userId)
    return null
  }
  if (demandee === actuelle) return actuelle
  if (demandee.startsWith('/uploads/temp/')) {
    const nouvelle = await rendreDefinitive(demandee, userId)
    await effacerAnciennePhoto(actuelle, userId)
    return nouvelle
  }
  throw createError({ status: 400, message: 'Photo de profil invalide' })
}
