import { promises as fs } from 'fs'
import { join, dirname } from 'path'

/**
 * Copie un fichier uploadé vers le dossier .output/public en production
 * pour qu'il soit accessible sans rebuild
 *
 * @param relativePath - Le chemin relatif depuis public (ex: "uploads/conventions/1/logo.jpg")
 *
 * ⚠️ CE FICHIER PORTAIT AUSSI `deleteFromBothLocations`, RETIRÉE : elle supprimait sous
 * `process.cwd()/public/uploads`, un dossier qui N'EXISTE PAS dans le conteneur (vérifié le
 * 1er octobre 2026). Les fichiers vivent sous le montage de nuxt-file-storage, et la suppression
 * d'image passe désormais par `deleteOldFile` de `file-helpers.ts`.
 *
 * ⚠️ `copyToOutputPublic` SUBSISTE parce que `move-temp-image.ts` l'appelle encore — mais elle
 * souffre du même écart de dossier : elle lit sa source sous `public/`, là où
 * `moveTempImageFromPlaceholder` vient d'écrire sous `/uploads`. Elle échoue donc en silence
 * (`console.error`, pas de `throw`), et seulement en production. Non corrigé ici : ce n'est pas
 * une suppression, et le dépôt sert désormais les fichiers par une route, pas depuis
 * `.output/public`. À traiter à part.
 */
export async function copyToOutputPublic(relativePath: string): Promise<void> {
  // Seulement en production
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  try {
    const sourcePath = join(process.cwd(), 'public', relativePath)
    const outputPath = join(process.cwd(), '.output', 'public', relativePath)

    // Créer le dossier de destination si nécessaire
    await fs.mkdir(dirname(outputPath), { recursive: true })

    // Copier le fichier
    await fs.copyFile(sourcePath, outputPath)

    console.log(`Fichier copié vers .output/public: ${relativePath}`)
  } catch (error) {
    console.error('Erreur lors de la copie vers .output/public:', error)
    // On ne throw pas l'erreur pour ne pas bloquer l'upload
  }
}
