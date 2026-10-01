import { beforeAll, afterAll } from 'vitest'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import mariadb from 'mariadb'

// Import dynamique de Prisma depuis le chemin personnalisé (cohérent avec server/utils/prisma.ts)
let PrismaClient: typeof import('../server/generated/prisma/client').PrismaClient
let prismaTest: import('../server/generated/prisma/client').PrismaClient

try {
  const prismaModule = await import('../server/generated/prisma/client')
  PrismaClient = prismaModule.PrismaClient
} catch {
  console.warn('Prisma Client non disponible, les tests DB seront skippés')
}

/*
 * Forcer l'utilisation de la base de données de test.
 *
 * ⚠️ LE DÉFAUT PAR DÉFAUT VISAIT 3308/convention_db, c'est-à-dire, sur la pile de développement, le
 * PORT DE LA BASE MIROIR avec le NOM DE LA BASE DE TRAVAIL. Aucune de ces deux valeurs ne désigne
 * une base de test : il visait, selon ce qui écoutait, la base miroir du développement ou rien.
 * Il pointe désormais le conteneur de `docker-compose.test.yml`, qui a son propre port (3310), sa
 * propre identité Compose et une base en RAM.
 */
if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'mysql://convention_user:convention_password@localhost:3310/convention_db_test'
}

/**
 * Le nom de la base que ces tests vont VIDER.
 *
 * ⚠️⚠️ LA BARRIÈRE QUI MANQUAIT, et qui compte plus que toutes les séparations de fichiers :
 * `cleanDatabase()` supprime utilisateurs, conventions, éditions, covoiturage, publications et
 * bénévoles de la base que l'environnement désigne — sans jamais vérifier LAQUELLE. Un
 * `DATABASE_URL` hérité du `.env` de développement suffisait donc à détruire la base de travail, et
 * c'est arrivé par deux chemins différents : depuis le conteneur de dev, et depuis l'hôte avec les
 * commandes documentées `npm run test:setup` / `npm run test:db:run`.
 *
 * La règle est volontairement grossière — le nom doit contenir « test » — parce qu'une règle fine
 * serait une règle qu'on contourne par accident. Elle laisse passer `convention_db_test` (la CI),
 * `convention_db_test` (le conteneur de test) et `convention_test_integration` (la base dédiée
 * qu'on emploie en local), et elle refuse `convention_db`.
 *
 * Elle LÈVE au lieu d'avertir : un avertissement laisserait la suite continuer, et le test suivant
 * écrirait dans la base de travail. C'est précisément ce que faisait le `catch` de `cleanDatabase`.
 */
const NOM_DE_BASE_ATTENDU = 'test'

function nomDeLaBaseVisee(): string {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!url) return ''
  try {
    return new URL(url).pathname.slice(1)
  } catch {
    return ''
  }
}

function exigerUneBaseDeTest(): void {
  const nom = nomDeLaBaseVisee()
  if (nom.includes(NOM_DE_BASE_ATTENDU)) return

  throw new Error(
    `Refus de lancer les tests d'intégration sur la base « ${nom || '(inconnue)'} » : son nom ne ` +
      `contient pas « ${NOM_DE_BASE_ATTENDU} ».\n` +
      `Ces tests VIDENT la base qu'on leur désigne. Démarrez celle de test ` +
      `(npm run test:setup, port 3310) ou passez TEST_DATABASE_URL vers une base dédiée.`
  )
}

// Instance Prisma pour les tests avec adaptateur MariaDB (Prisma 7)
if (PrismaClient) {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  const url = new URL(databaseUrl)

  // Créer l'adaptateur MariaDB avec les paramètres de connexion
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    connectionLimit: 5,
    bigIntAsNumber: true,
  })

  prismaTest = new PrismaClient({
    adapter,
  })

  // Exposer prismaTest comme global 'prisma' pour simuler l'auto-import Nitro
  // Cela permet aux fonctions server/utils/* d'utiliser prisma directement
  ;(globalThis as any).prisma = prismaTest
}

export { prismaTest }

// Configuration globale pour les tests avec DB
if (process.env.TEST_WITH_DB === 'true') {
  beforeAll(async () => {
    console.log("🔄 Initialisation des tests d'intégration...")
    // Avant TOUTE connexion : on ne se connecte même pas à une base qu'on n'a pas le droit de
    // vider. Placé ici et non dans `cleanDatabase` pour que l'échec soit franc et immédiat, au
    // lieu de survenir après que des tests ont déjà écrit.
    exigerUneBaseDeTest()
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
  throw new Error("La base de données n'est pas disponible après " + maxRetries + ' tentatives')
}

// Fonction pour nettoyer la base de données
async function cleanDatabase() {
  if (!prismaTest) return

  // Deuxième contrôle, au plus près de la destruction : cette fonction est appelée par le
  // `beforeAll` ci-dessus, mais rien n'empêche un futur appelant de la joindre autrement.
  exigerUneBaseDeTest()

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
    await prismaTest.conventionOrganizer.deleteMany({})
    await prismaTest.edition.deleteMany({})
    await prismaTest.convention.deleteMany({})
    await prismaTest.user.deleteMany({})
    console.log('🗑️ Nettoyage DB terminé')
  } catch (error) {
    console.warn('⚠️ Erreur lors du nettoyage de la DB:', error?.message || error)
  }
}
