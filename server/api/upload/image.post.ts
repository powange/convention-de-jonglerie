import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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

    // Créer le dossier uploads s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Générer un nom de fichier unique
    const fileExtension = file.filename?.split('.').pop() || 'jpg';
    const fileName = `convention-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
    const filePath = join(uploadsDir, fileName);

    // Sauvegarder le fichier
    const writeStream = createWriteStream(filePath);
    writeStream.write(file.data);
    writeStream.end();

    // Retourner l'URL publique
    const imageUrl = `/uploads/${fileName}`;
    
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