import { beforeAll, afterAll } from 'vitest'

// Import dynamique de Prisma pour éviter les problèmes de résolution
let PrismaClient: typeof import('@prisma/client').PrismaClient
let prismaTest: import('@prisma/client').PrismaClient

try {
  const prismaModule = await import('@prisma/client')
  PrismaClient = prismaModule.PrismaClient
} catch {
  console.warn('Prisma Client non disponible, les tests DB seront skippés')
}

// Forcer l'utilisation de la base de données de test
// En environnement Docker, utiliser l'URL fournie par l'environnement
if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'mysql://convention_user:convention_password@localhost:3307/convention_db'
}

// Instance Prisma pour les tests
if (PrismaClient) {
  prismaTest = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      },
    },
  })
}

export { prismaTest }

// Configuration globale pour les tests avec DB
if (process.env.TEST_WITH_DB === 'true') {
  beforeAll(async () => {
    console.log("🔄 Initialisation des tests d'intégration...")
    try {
      // Attendre que MySQL soit prêt (la DB est déjà démarrée par le script)
      await waitForDatabase()
      console.log('✅ Connexion à la base de données de test réussie')

      // Nettoyage initial
      await cleanDatabase()
      console.log('🧹 Base de données nettoyée pour les tests')
    } catch (err) {
      console.error('❌ Erreur lors de la connexion à la DB de test:', err)
      throw err
    }
  }, 60000)

  // Pas de nettoyage entre les tests - les IDs uniques évitent les conflits

  afterAll(async () => {
    // Déconnecter Prisma
    await prismaTest.$disconnect()
    console.log('🔌 Déconnexion de la base de données de test')
  })
}

// Fonction pour attendre que la DB soit prête
async function waitForDatabase(maxRetries = 20) {
  console.log('🔍 Vérification de la connexion à la base de données...')

  for (let i = 0; i < maxRetries; i++) {
    try {
      await prismaTest.$connect()
      await prismaTest.$queryRaw`SELECT 1`
      console.log(`✅ Base de données prête après ${i + 1} tentative(s)`)
      return
    } catch (error) {
      if (i < 5 || i % 5 === 0) {
        console.log(`⏳ Attente de la base de données... (${i + 1}/${maxRetries})`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  throw new Error("La base de données n'est pas disponible après " + maxRetries + " tentatives")
}

// Fonction pour nettoyer la base de données
async function cleanDatabase() {
  if (!prismaTest) return

  try {
    // Supprimer dans l'ordre des dépendances (enfants avant parents)
    await prismaTest.passwordResetToken.deleteMany({})
    await prismaTest.carpoolPassenger.deleteMany({})
    await prismaTest.carpoolRequestComment.deleteMany({})
    await prismaTest.carpoolComment.deleteMany({})
    await prismaTest.carpoolRequest.deleteMany({})
    await prismaTest.carpoolOffer.deleteMany({})
    await prismaTest.editionPostComment.deleteMany({})
    await prismaTest.editionPost.deleteMany({})
    await prismaTest.editionVolunteerApplication.deleteMany({})
    await prismaTest.volunteerTeam.deleteMany({})
    await prismaTest.conventionCollaborator.deleteMany({})
    await prismaTest.edition.deleteMany({})
    await prismaTest.convention.deleteMany({})
    await prismaTest.user.deleteMany({})
    console.log('🗑️ Nettoyage DB terminé')
  } catch (error) {
    console.warn('⚠️ Erreur lors du nettoyage de la DB:', error?.message || error)
  }
}
