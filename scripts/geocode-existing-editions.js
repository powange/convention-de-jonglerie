import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 5; // Nombre d'éditions à traiter en parallèle
const DELAY_BETWEEN_BATCHES = 2000; // Délai entre les batches en ms
const RETRY_ATTEMPTS = 3; // Nombre de tentatives en cas d'échec

// Polyfill pour fetch si nécessaire (Node.js < 18)
async function setupFetch() {
  if (typeof fetch === 'undefined') {
    try {
      const { default: fetch } = await import('node-fetch');
      globalThis.fetch = fetch;
    } catch (error) {
      console.error('❌ Node-fetch non disponible. Veuillez installer node-fetch ou utiliser Node.js 18+');
      process.exit(1);
    }
  }
}

// Service de géocodage simplifié
async function geocodeAddress(addressLine1, city, postalCode, country, addressLine2) {
  try {
    // Construire l'adresse complète
    const addressParts = [addressLine1];
    if (addressLine2) {
      addressParts.push(addressLine2);
    }
    addressParts.push(city, postalCode, country);
    const fullAddress = addressParts.join(', ');

    // Utiliser l'API Nominatim (OpenStreetMap)
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodedAddress}`,
      {
        headers: {
          'User-Agent': 'Convention-de-Jonglerie-App/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error('Erreur lors du géocodage:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon)
    };

  } catch (error) {
    console.error('Erreur lors du géocodage:', error);
    return null;
  }
}

// Fonction pour géocoder une édition avec retry
async function geocodeEditionWithRetry(edition, attempt = 1) {
  try {
    console.log(`🔍 [${attempt}/${RETRY_ATTEMPTS}] Géocodage de l'édition ${edition.id}: ${edition.name || 'Sans nom'} (${edition.city}, ${edition.country})`);
    
    const coords = await geocodeAddress(
      edition.addressLine1,
      edition.city,
      edition.postalCode,
      edition.country,
      edition.addressLine2
    );

    if (coords && coords.latitude && coords.longitude) {
      return { success: true, coords };
    } else {
      console.log(`⚠️  Aucune coordonnée trouvée pour l'édition ${edition.id}`);
      return { success: false };
    }
  } catch (error) {
    console.error(`❌ Erreur tentative ${attempt} pour l'édition ${edition.id}:`, error);
    
    if (attempt < RETRY_ATTEMPTS) {
      console.log(`🔄 Nouvelle tentative dans 3 secondes...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return geocodeEditionWithRetry(edition, attempt + 1);
    }
    
    return { success: false };
  }
}

// Fonction pour traiter un batch d'éditions
async function processBatch(editions, batchIndex) {
  console.log(`\n📦 Traitement du batch ${batchIndex + 1} (${editions.length} éditions):`);
  
  const promises = editions.map(async (edition) => {
    const result = await geocodeEditionWithRetry(edition);
    
    if (result.success && result.coords) {
      try {
        await prisma.edition.update({
          where: { id: edition.id },
          data: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude
          }
        });
        
        console.log(`   ✅ Édition ${edition.id}: ${result.coords.latitude}, ${result.coords.longitude}`);
        return { success: true };
      } catch (dbError) {
        console.error(`   💾 Erreur DB pour l'édition ${edition.id}:`, dbError);
        return { success: false };
      }
    } else {
      console.log(`   ❌ Échec pour l'édition ${edition.id}`);
      return { success: false };
    }
  });

  const results = await Promise.all(promises);
  const success = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).length;
  
  return { success, errors };
}

async function geocodeExistingEditions() {
  console.log('🗺️  Démarrage du géocodage des éditions existantes...');
  console.log(`⚙️  Configuration: ${BATCH_SIZE} éditions par batch, ${DELAY_BETWEEN_BATCHES}ms entre les batches`);
  
  // Configurer fetch si nécessaire
  await setupFetch();
  
  try {
    // Récupérer toutes les éditions sans coordonnées
    const editions = await prisma.edition.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null }
        ]
      },
      select: {
        id: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
        name: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`📍 ${editions.length} éditions à géocoder`);

    if (editions.length === 0) {
      console.log('🎉 Toutes les éditions ont déjà des coordonnées !');
      return;
    }

    // Diviser en batches
    const batches = [];
    for (let i = 0; i < editions.length; i += BATCH_SIZE) {
      batches.push(editions.slice(i, i + BATCH_SIZE));
    }

    console.log(`📦 ${batches.length} batches à traiter`);

    let totalSuccess = 0;
    let totalErrors = 0;
    const startTime = Date.now();

    // Traiter chaque batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResult = await processBatch(batch, i);
      
      totalSuccess += batchResult.success;
      totalErrors += batchResult.errors;

      // Pause between batches (sauf pour le dernier)
      if (i < batches.length - 1) {
        console.log(`⏳ Pause de ${DELAY_BETWEEN_BATCHES}ms avant le prochain batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`\n🎯 RÉSULTATS FINAUX:`);
    console.log(`   ✅ Succès: ${totalSuccess}/${editions.length} (${Math.round(totalSuccess / editions.length * 100)}%)`);
    console.log(`   ❌ Erreurs: ${totalErrors}/${editions.length} (${Math.round(totalErrors / editions.length * 100)}%)`);
    console.log(`   ⏱️  Durée totale: ${duration}s`);
    if (duration > 0) {
      console.log(`   ⚡ Moyenne: ${Math.round(editions.length / duration * 10) / 10} éditions/seconde`);
    }

  } catch (error) {
    console.error('💥 Erreur générale:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
geocodeExistingEditions()
  .then(() => {
    console.log('\n🎉 Géocodage terminé !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });