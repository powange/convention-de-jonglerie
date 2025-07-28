import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { copyToOutputPublic } from '../../utils/copy-to-output';

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  try {
    const form = await readMultipartFormData(event);
    const file = form?.find(item => item.name === 'image');
    const conventionIdField = form?.find(item => item.name === 'conventionId');
    
    // Si un conventionId est fourni, c'est pour une convention existante
    const conventionId = conventionIdField ? conventionIdField.data.toString() : null;

    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No image file provided',
      });
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type || '')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file type. Only JPEG, PNG and WebP are allowed',
      });
    }

    // Déterminer le dossier de destination
    let uploadsDir;
    let fileName;
    let imageUrl;
    
    if (conventionId) {
      // Pour une convention existante, utiliser le dossier dédié
      uploadsDir = join(process.cwd(), 'public', 'uploads', 'conventions', conventionId);
      const fileExtension = file.filename?.split('.').pop() || 'jpg';
      fileName = `convention-${conventionId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
      imageUrl = `/uploads/conventions/${conventionId}/${fileName}`;
    } else {
      // Pour une nouvelle convention, utiliser le dossier temporaire
      uploadsDir = join(process.cwd(), 'public', 'uploads', 'temp');
      const fileExtension = file.filename?.split('.').pop() || 'jpg';
      fileName = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
      imageUrl = `/uploads/temp/${fileName}`;
    }
    
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, fileName);

    // Sauvegarder le fichier
    const writeStream = createWriteStream(filePath);
    writeStream.write(file.data);
    writeStream.end();
    
    // Attendre que l'écriture soit terminée
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    // Copier vers .output/public en production
    if (conventionId) {
      await copyToOutputPublic(`uploads/conventions/${conventionId}/${fileName}`);
    } else {
      await copyToOutputPublic(`uploads/temp/${fileName}`);
    }
    
    return {
      success: true,
      imageUrl,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload image',
    });
  }
});