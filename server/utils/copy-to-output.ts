import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * Copie un fichier uploadé vers le dossier .output/public en production
 * pour qu'il soit accessible sans rebuild
 * 
 * @param relativePath - Le chemin relatif depuis public (ex: "uploads/conventions/1/logo.jpg")
 */
export async function copyToOutputPublic(relativePath: string): Promise<void> {
  // Seulement en production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const sourcePath = join(process.cwd(), 'public', relativePath);
    const outputPath = join(process.cwd(), '.output', 'public', relativePath);
    
    // Créer le dossier de destination si nécessaire
    await fs.mkdir(dirname(outputPath), { recursive: true });
    
    // Copier le fichier
    await fs.copyFile(sourcePath, outputPath);
    
    console.log(`Fichier copié vers .output/public: ${relativePath}`);
  } catch (error) {
    console.error('Erreur lors de la copie vers .output/public:', error);
    // On ne throw pas l'erreur pour ne pas bloquer l'upload
  }
}

/**
 * Supprime un fichier des deux emplacements : public/ et .output/public/
 * 
 * @param relativePath - Le chemin relatif depuis public (ex: "uploads/conventions/1/logo.jpg")
 */
export async function deleteFromBothLocations(relativePath: string): Promise<void> {
  const publicPath = join(process.cwd(), 'public', relativePath);
  const outputPath = join(process.cwd(), '.output', 'public', relativePath);
  
  // Supprimer de public/
  try {
    await fs.unlink(publicPath);
    console.log(`Fichier supprimé de public: ${relativePath}`);
  } catch (error) {
    console.warn(`Impossible de supprimer de public: ${relativePath}`, error);
  }
  
  // Supprimer de .output/public/ (seulement en production)
  if (process.env.NODE_ENV === 'production') {
    try {
      await fs.unlink(outputPath);
      console.log(`Fichier supprimé de .output/public: ${relativePath}`);
    } catch (error) {
      console.warn(`Impossible de supprimer de .output/public: ${relativePath}`, error);
    }
  }
}