import { promises as fs } from 'fs'
import { join } from 'path'

import { copyToOutputPublic } from './copy-to-output'

/**
 * Déplace une image temporaire vers le dossier final de l'édition
 * @param tempImageUrl - L'URL temporaire de l'image
 * @param editionId - L'ID de l'édition
 * @returns La nouvelle URL de l'image
 */
export async function moveTempImageToEdition(
  tempImageUrl: string,
  editionId: number
): Promise<string | null> {
  return moveTempImageToConvention(tempImageUrl, editionId)
}

// Alias pour la compatibilité
export async function moveTempImageToConvention(
  tempImageUrl: string,
  conventionId: number
): Promise<string | null> {
  if (!tempImageUrl || !tempImageUrl.includes('/temp/')) {
    return tempImageUrl // Pas une image temporaire
  }

  try {
    const filename = tempImageUrl.split('/').pop()
    if (!filename) return null

    const tempPath = join(process.cwd(), 'public', 'uploads', 'temp', filename)
    const editionDir = join(process.cwd(), 'public', 'uploads', 'editions', conventionId.toString())

    // Créer le dossier de destination
    await fs.mkdir(editionDir, { recursive: true })

    // Générer un nouveau nom de fichier
    const extension = filename.split('.').pop() || 'jpg'
    const newFilename = `edition-${conventionId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`
    const newPath = join(editionDir, newFilename)

    // Déplacer le fichier
    await fs.rename(tempPath, newPath)

    // Copier vers .output/public en production
    await copyToOutputPublic(`uploads/editions/${conventionId}/${newFilename}`)

    // Retourner la nouvelle URL
    return `/uploads/editions/${conventionId}/${newFilename}`
  } catch (error) {
    console.error("Erreur lors du déplacement de l'image temporaire:", error)
    return null
  }
}
