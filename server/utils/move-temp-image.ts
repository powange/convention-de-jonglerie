import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Déplace une image temporaire vers le dossier final de la convention
 * @param tempImageUrl - L'URL temporaire de l'image
 * @param conventionId - L'ID de la convention
 * @returns La nouvelle URL de l'image
 */
export async function moveTempImageToConvention(tempImageUrl: string, conventionId: number): Promise<string | null> {
  if (!tempImageUrl || !tempImageUrl.includes('/temp/')) {
    return tempImageUrl; // Pas une image temporaire
  }

  try {
    const filename = tempImageUrl.split('/').pop();
    if (!filename) return null;

    const tempPath = join(process.cwd(), 'public', 'uploads', 'temp', filename);
    const conventionDir = join(process.cwd(), 'public', 'uploads', 'conventions', conventionId.toString());
    
    // Créer le dossier de destination
    await fs.mkdir(conventionDir, { recursive: true });
    
    // Générer un nouveau nom de fichier
    const extension = filename.split('.').pop() || 'jpg';
    const newFilename = `convention-${conventionId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
    const newPath = join(conventionDir, newFilename);
    
    // Déplacer le fichier
    await fs.rename(tempPath, newPath);
    
    // Retourner la nouvelle URL
    return `/uploads/conventions/${conventionId}/${newFilename}`;
  } catch (error) {
    console.error('Erreur lors du déplacement de l\'image temporaire:', error);
    return null;
  }
}