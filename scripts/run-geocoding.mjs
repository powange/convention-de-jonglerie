import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 3;
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 secondes entre chaque requête

// Service de géocodage
async function geocodeAddress(addressLine1, city, postalCode, country, addressLine2) {
  try {
    // Construire l'adresse complète
    const addressParts = [addressLine1];
    if (addressLine2) {
      addressParts.push(addressLine2);
    }
    addressParts.push(city, postalCode, country);
    const fullAddress = addressParts.join(', ');

    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodedAddress}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Convention-de-Jonglerie-App/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    console.error('Erreur géocodage:', error.message);
    return null;
  }
}

async function main() {
  console.log('🗺️  Script de géocodage des éditions');
  
  try {
    // Récupérer les éditions sans coordonnées
    const editions = await prisma.edition.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null }
        ]
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true
      }
    });

    console.log(`📍 ${editions.length} éditions à géocoder`);

    if (editions.length === 0) {
      console.log('✅ Toutes les éditions ont déjà des coordonnées !');
      return;
    }

    let processed = 0;
    let success = 0;
    let errors = 0;

    for (const edition of editions) {
      processed++;
      console.log(`\n[${processed}/${editions.length}] 🔍 ${edition.name || 'Sans nom'} (${edition.city})`);
      
      try {
        const coords = await geocodeAddress(
          edition.addressLine1,
          edition.city,
          edition.postalCode,
          edition.country,
          edition.addressLine2
        );

        if (coords) {
          await prisma.edition.update({
            where: { id: edition.id },
            data: {
              latitude: coords.latitude,
              longitude: coords.longitude
            }
          });
          
          console.log(`   ✅ ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          success++;
        } else {
          console.log(`   ❌ Aucune coordonnée trouvée`);
          errors++;
        }

      } catch (error) {
        console.log(`   💥 Erreur: ${error.message}`);
        errors++;
      }

      // Pause entre les requêtes
      if (processed < editions.length) {
        console.log(`   ⏳ Pause ${DELAY_BETWEEN_REQUESTS}ms...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    console.log(`\n🎯 RÉSULTATS:`);
    console.log(`   ✅ Succès: ${success}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Total: ${processed}`);
    console.log(`   📈 Taux de succès: ${Math.round(success/processed*100)}%`);

  } catch (error) {
    console.error('💥 Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
main()
  .then(() => {
    console.log('\n🎉 Terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });