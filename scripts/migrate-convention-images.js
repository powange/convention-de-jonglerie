import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const prisma = new PrismaClient();

async function migrateConventionImages() {
  try {
    console.log('🔄 Début de la migration des images de conventions...');
    
    // Récupérer toutes les conventions avec une image
    const conventions = await prisma.convention.findMany({
      where: {
        imageUrl: {
          not: null,
        },
      },
    });
    
    console.log(`📊 ${conventions.length} conventions avec images trouvées`);
    
    const uploadsDir = join(__dirname, '..', 'public', 'uploads');
    
    for (const convention of conventions) {
      if (!convention.imageUrl) continue;
      
      // Vérifier si l'image est déjà dans le bon format
      if (convention.imageUrl.includes(`/conventions/${convention.id}/`)) {
        console.log(`✅ Convention ${convention.id} déjà migrée`);
        continue;
      }
      
      // Extraire le nom du fichier
      const filename = convention.imageUrl.split('/').pop();
      if (!filename || !filename.startsWith('convention-')) {
        console.log(`⚠️ Convention ${convention.id}: nom de fichier invalide`);
        continue;
      }
      
      const oldPath = join(uploadsDir, filename);
      const newDir = join(uploadsDir, 'conventions', convention.id.toString());
      const newPath = join(newDir, filename);
      
      try {
        // Vérifier si l'ancien fichier existe
        await fs.access(oldPath);
        
        // Créer le nouveau dossier
        await fs.mkdir(newDir, { recursive: true });
        
        // Déplacer le fichier
        await fs.rename(oldPath, newPath);
        
        // Mettre à jour l'URL dans la base de données
        const newUrl = `/uploads/conventions/${convention.id}/${filename}`;
        await prisma.convention.update({
          where: { id: convention.id },
          data: { imageUrl: newUrl },
        });
        
        console.log(`✅ Convention ${convention.id}: image migrée vers ${newUrl}`);
      } catch (error) {
        console.error(`❌ Convention ${convention.id}: erreur lors de la migration`, error.message);
      }
    }
    
    console.log('✨ Migration terminée !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migrateConventionImages();