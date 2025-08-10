import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Données de test pour les conventions et éditions
const conventionsData = [
  {
    name: "Festival Européen de Jonglerie",
    description: "Le plus grand rassemblement de jongleurs d'Europe avec workshops, spectacles et échanges internationaux.",
    logo: "https://example.com/logo-european-juggling.png"
  },
  {
    name: "Convention Française de Jonglage",
    description: "Rendez-vous annuel des jongleurs français pour partager techniques et passion.",
    logo: "https://example.com/logo-french-juggling.png"
  },
  {
    name: "Cirque et Jonglerie du Monde",
    description: "Festival multiculturel mêlant jonglerie traditionnelle et moderne du monde entier.",
    logo: "https://example.com/logo-world-circus.png"
  },
  {
    name: "Rassemblement des Arts du Cirque",
    description: "Convention dédiée à tous les arts du cirque : jonglerie, acrobatie, équilibre.",
    logo: "https://example.com/logo-circus-arts.png"
  },
  {
    name: "Festival des Objets Volants",
    description: "Spécialisé dans la jonglerie d'objets : balles, massues, anneaux, diabolos.",
    logo: "https://example.com/logo-flying-objects.png"
  }
];

const citiesData = [
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522, postalCode: "75001" },
  { city: "Lyon", country: "France", lat: 45.7640, lng: 4.8357, postalCode: "69001" },
  { city: "Marseille", country: "France", lat: 43.2965, lng: 5.3698, postalCode: "13001" },
  { city: "Toulouse", country: "France", lat: 43.6047, lng: 1.4442, postalCode: "31000" },
  { city: "Strasbourg", country: "France", lat: 48.5734, lng: 7.7521, postalCode: "67000" },
  { city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050, postalCode: "10115" },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, postalCode: "1012" },
  { city: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734, postalCode: "08001" },
  { city: "Brussels", country: "Belgium", lat: 50.8503, lng: 4.3517, postalCode: "1000" },
  { city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, postalCode: "00100" }
];

// Fonction pour générer une date aléatoire
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Fonction pour générer des dates d'édition cohérentes
function generateEditionDates(baseYear) {
  const startDate = randomDate(
    new Date(baseYear, 2, 1), // Mars
    new Date(baseYear, 9, 31)  // Octobre
  );
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 6) + 2); // 2-7 jours
  
  return { startDate, endDate };
}

// Fonction pour générer les services aléatoirement
function generateServices() {
  return {
    hasFoodTrucks: Math.random() > 0.4,
    hasKidsZone: Math.random() > 0.6,
    acceptsPets: Math.random() > 0.7,
    hasTentCamping: Math.random() > 0.3,
    hasTruckCamping: Math.random() > 0.5,
    hasGym: Math.random() > 0.6,
    hasFamilyCamping: Math.random() > 0.4,
    hasFireSpace: Math.random() > 0.5,
    hasGala: Math.random() > 0.3,
    hasOpenStage: Math.random() > 0.4,
    hasConcert: Math.random() > 0.6,
    hasCantine: Math.random() > 0.2,
    hasAerialSpace: Math.random() > 0.7,
    hasSlacklineSpace: Math.random() > 0.6,
    hasToilets: Math.random() > 0.1, // Presque toujours
    hasShowers: Math.random() > 0.3,
    hasAccessibility: Math.random() > 0.5,
    hasWorkshops: Math.random() > 0.2, // Très souvent
    hasCreditCardPayment: Math.random() > 0.3,
    hasAfjTokenPayment: Math.random() > 0.8,
    hasLongShow: Math.random() > 0.6,
    hasATM: Math.random() > 0.5
  };
}

async function main() {
  console.log('🚀 Génération des données de test...');

  // 1. Trouver l'utilisateur powange
  console.log('📋 Recherche de l\'utilisateur powange...');
  let user = await prisma.user.findUnique({
    where: { pseudo: 'powange' }
  });

  if (!user) {
    console.log('👤 Création de l\'utilisateur powange...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email: 'powange@example.com',
        pseudo: 'powange',
        nom: 'Powange',
        prenom: 'Test',
        password: hashedPassword,
        isEmailVerified: true
      }
    });
  }

  console.log(`✅ Utilisateur trouvé/créé: ${user.pseudo} (ID: ${user.id})`);

  // 2. Créer les conventions
  console.log('🎪 Création des conventions...');
  const conventions = [];

  for (const conventionData of conventionsData) {
    const convention = await prisma.convention.create({
      data: {
        ...conventionData,
        authorId: user.id
      }
    });
    conventions.push(convention);
    console.log(`  ✅ Convention créée: ${convention.name}`);
  }

  // 3. Créer des éditions pour chaque convention
  console.log('📅 Création des éditions...');
  let totalEditions = 0;

  for (const convention of conventions) {
    // Créer 8-12 éditions par convention pour bien tester la pagination
    const editionCount = Math.floor(Math.random() * 5) + 8; // 8-12 éditions
    
    for (let i = 0; i < editionCount; i++) {
      // Éditions sur les 3 dernières années + année courante + année suivante
      const year = 2022 + Math.floor(Math.random() * 4); // 2022-2025
      const { startDate, endDate } = generateEditionDates(year);
      const location = citiesData[Math.floor(Math.random() * citiesData.length)];
      const services = generateServices();

      const edition = await prisma.edition.create({
        data: {
          name: `${convention.name} ${year}`,
          description: `Édition ${year} de ${convention.name}. Une expérience inoubliable avec des artistes du monde entier.`,
          startDate,
          endDate,
          addressLine1: `${Math.floor(Math.random() * 999) + 1} rue de la Jonglerie`,
          addressLine2: location.city === "Paris" ? `${Math.floor(Math.random() * 20) + 1}ème arrondissement` : "",
          city: location.city,
          country: location.country,
          postalCode: location.postalCode,
          region: "",
          latitude: location.lat + (Math.random() - 0.5) * 0.1, // Petite variation
          longitude: location.lng + (Math.random() - 0.5) * 0.1,
          facebookUrl: Math.random() > 0.6 ? `https://facebook.com/${convention.name.toLowerCase().replace(/\s+/g, '-')}-${year}` : null,
          instagramUrl: Math.random() > 0.5 ? `https://instagram.com/${convention.name.toLowerCase().replace(/\s+/g, '')}_${year}` : null,
          ticketingUrl: Math.random() > 0.4 ? `https://billetterie.example.com/${convention.id}/${year}` : null,
          imageUrl: Math.random() > 0.3 ? `https://example.com/images/${convention.id}/${year}/main.jpg` : null,
          creatorId: user.id,
          conventionId: convention.id,
          ...services
        }
      });

      totalEditions++;
      if (totalEditions % 10 === 0) {
        console.log(`  📊 ${totalEditions} éditions créées...`);
      }
    }
  }

  console.log(`🎉 Génération terminée !`);
  console.log(`📈 Résumé:`);
  console.log(`  - ${conventions.length} conventions créées`);
  console.log(`  - ${totalEditions} éditions créées`);
  console.log(`  - Toutes assignées à l'utilisateur: ${user.pseudo}`);
  
  // Vérification avec pagination
  const testPagination = await prisma.edition.count();
  const pages = Math.ceil(testPagination / 20);
  console.log(`  - ${testPagination} éditions au total (${pages} pages avec limite de 20)`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la génération:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });