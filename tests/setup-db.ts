import { beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'child_process'

// Import dynamique de Prisma pour éviter les problèmes de résolution
let PrismaClient: any
let prismaTest: any

try {
  const prismaModule = await import('@prisma/client')
  PrismaClient = prismaModule.PrismaClient
} catch (error) {
  console.warn('Prisma Client non disponible, les tests DB seront skippés')
}

// Forcer l'utilisation de la base de données de test
process.env.DATABASE_URL = 'mysql://testuser:testpassword@localhost:3307/convention_jonglerie_test'

// Instance Prisma pour les tests
if (PrismaClient) {
  prismaTest = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
}

export { prismaTest }

// Configuration globale pour les tests avec DB
if (process.env.TEST_WITH_DB === 'true') {
  beforeAll(async () => {
    console.log('🔄 Initialisation des tests d\'intégration...')
    try {
      // Attendre que MySQL soit prêt (la DB est déjà démarrée par le script)
      await waitForDatabase()
      console.log('✅ Connexion à la base de données de test réussie')
    } catch (error) {
      console.error('❌ Erreur lors de la connexion à la DB de test:', error)
      throw error
    }
  }, 30000)

  beforeEach(async () => {
    // Nettoyer les données entre chaque test
    await cleanDatabase()
  })

  afterAll(async () => {
    // Déconnecter Prisma
    await prismaTest.$disconnect()
    console.log('🔌 Déconnexion de la base de données de test')
  })
}

// Fonction pour attendre que la DB soit prête
async function waitForDatabase(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prismaTest.$connect()
      await prismaTest.$queryRaw`SELECT 1`
      return
    } catch (error) {
      console.log(`⏳ Attente de la base de données... (${i + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  throw new Error('La base de données n\'est pas disponible')
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
    await prismaTest.conventionCollaborator.deleteMany({})
    await prismaTest.edition.deleteMany({})
    await prismaTest.convention.deleteMany({})
    await prismaTest.user.deleteMany({})
  } catch (error) {
    console.warn('Erreur lors du nettoyage de la DB:', error)
  }
}