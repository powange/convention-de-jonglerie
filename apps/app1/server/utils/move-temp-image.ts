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

/**
 * Déplace une image temporaire stockée avec placeholder NEW_EDITION vers le dossier final
 * @param tempImageUrl - L'URL temporaire avec placeholder (ex: /uploads/temp/editions/NEW_EDITION/filename.jpg)
 * @param editionId - L'ID réel de l'édition créée
 * @returns La nouvelle URL de l'image
 */
export async function moveTempImageFromPlaceholder(
  tempImageUrl: string,
  editionId: number
): Promise<string | null> {
  if (!tempImageUrl || !tempImageUrl.includes('/temp/editions/NEW_EDITION/')) {
    return tempImageUrl // Pas une image avec placeholder
  }

  try {
    const filename = tempImageUrl.split('/').pop()
    if (!filename) return null

    const tempPath = `/uploads/temp/editions/NEW_EDITION/${filename}`
    const editionDir = `/uploads/conventions/${editionId}`

    // Créer le dossier de destination
    await fs.mkdir(editionDir, { recursive: true })

    // Générer un nouveau nom de fichier
    const extension = filename.split('.').pop() || 'jpg'
    const newFilename = `edition-${editionId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`
    const newPath = `${editionDir}/${newFilename}`

    // Déplacer le fichier
    await fs.rename(tempPath, newPath)

    // Copier vers .output/public en production
    await copyToOutputPublic(`uploads/conventions/${editionId}/${newFilename}`)

    console.log(`Image déplacée de ${tempPath} vers ${newPath}`)

    // Retourner la nouvelle URL
    return `/uploads/conventions/${editionId}/${newFilename}`
  } catch (error) {
    console.error("Erreur lors du déplacement de l'image depuis placeholder:", error)
    return null
  }
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
    // Utiliser 'conventions' au lieu de 'editions' pour être cohérent
    const editionDir = join(
      process.cwd(),
      'public',
      'uploads',
      'conventions',
      conventionId.toString()
    )

    // Créer le dossier de destination
    await fs.mkdir(editionDir, { recursive: true })

    // Générer un nouveau nom de fichier
    const extension = filename.split('.').pop() || 'jpg'
    const newFilename = `edition-${conventionId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`
    const newPath = join(editionDir, newFilename)

    // Déplacer le fichier
    await fs.rename(tempPath, newPath)

    // Copier vers .output/public en production
    await copyToOutputPublic(`uploads/conventions/${conventionId}/${newFilename}`)

    // Retourner la nouvelle URL cohérente
    return `/uploads/conventions/${conventionId}/${newFilename}`
  } catch (error) {
    console.error("Erreur lors du déplacement de l'image temporaire:", error)
    return null
  }
}
