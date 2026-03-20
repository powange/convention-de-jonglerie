import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'

// Vérifier si DATABASE_URL est définie
const databaseUrl = process.env.DATABASE_URL

let prisma: InstanceType<typeof PrismaClient> | null = null
if (databaseUrl) {
  const url = new URL(databaseUrl)
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    connectionLimit: 2,
    bigIntAsNumber: true,
    allowPublicKeyRetrieval: true,
  })
  prisma = new PrismaClient({ adapter })
}

async function listSeedAccounts() {
  console.log('🔑 Comptes créés par le seeder de développement:\n')

  if (!prisma) {
    console.log('⚠️  DATABASE_URL non définie - Affichage des comptes par défaut\n')
  }

  // Comptes administrateurs
  console.log('📋 COMPTES ADMINISTRATEURS:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@powange.fr'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'devpass'

  if (prisma) {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (admin) {
      console.log(`✅ Admin principal`)
      console.log(`   📧 Email: ${admin.email}`)
      console.log(`   🔒 Mot de passe: ${adminPassword}`)
      console.log(`   👤 Pseudo: ${admin.pseudo}`)
      console.log()
    }
  } else {
    console.log(`📋 Admin principal`)
    console.log(`   📧 Email: ${adminEmail}`)
    console.log(`   🔒 Mot de passe: ${adminPassword}`)
    console.log(`   👤 Pseudo: AdminSeed`)
    console.log()
  }

  const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@powange.fr'
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123'

  if (prisma) {
    const superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } })
    if (superAdmin) {
      console.log(`✅ Super Admin`)
      console.log(`   📧 Email: ${superAdmin.email}`)
      console.log(`   🔒 Mot de passe: ${superAdminPassword}`)
      console.log(`   👤 Pseudo: ${superAdmin.pseudo}`)
      console.log()
    }
  } else {
    console.log(`📋 Super Admin`)
    console.log(`   📧 Email: ${superAdminEmail}`)
    console.log(`   🔒 Mot de passe: ${superAdminPassword}`)
    console.log(`   👤 Pseudo: SuperAdmin`)
    console.log()
  }

  const powangeUserEmail = process.env.POWANGE_USER_EMAIL || 'user@powange.fr'
  const powangeUserPassword = process.env.POWANGE_USER_PASSWORD || 'userpass'

  if (prisma) {
    const powangeUser = await prisma.user.findUnique({ where: { email: powangeUserEmail } })
    if (powangeUser) {
      console.log(`✅ Utilisateur Powange`)
      console.log(`   📧 Email: ${powangeUser.email}`)
      console.log(`   🔒 Mot de passe: ${powangeUserPassword}`)
      console.log(`   👤 Pseudo: ${powangeUser.pseudo}`)
      console.log()
    }
  } else {
    console.log(`📋 Utilisateur Powange`)
    console.log(`   📧 Email: ${powangeUserEmail}`)
    console.log(`   🔒 Mot de passe: ${powangeUserPassword}`)
    console.log(`   👤 Pseudo: PowangeUser`)
    console.log()
  }

  // Utilisateurs de test
  console.log('🧪 UTILISATEURS DE TEST:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔒 Mot de passe pour tous: testpass\n')

  const testUsers = [
    { email: 'alice.jongleuse@example.com', pseudo: 'AliceJongle', prenom: 'Alice', nom: 'Dubois' },
    { email: 'bob.cirque@example.com', pseudo: 'BobCircus', prenom: 'Bob', nom: 'Martin' },
    {
      email: 'charlie.diabolo@example.com',
      pseudo: 'CharlieDiab',
      prenom: 'Charlie',
      nom: 'Rousseau',
    },
    { email: 'diana.massues@example.com', pseudo: 'DianaMassues', prenom: 'Diana', nom: 'Lefevre' },
    { email: 'eve.contact@example.com', pseudo: 'EveContact', prenom: 'Eve', nom: 'Moreau' },
  ]

  for (const userData of testUsers) {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: userData.email } })
      if (user) {
        console.log(`✅ ${user.prenom} ${user.nom} (${user.pseudo})`)
        console.log(`   📧 ${user.email}`)
      } else {
        console.log(`❌ ${userData.prenom} ${userData.nom} (non trouvé en BDD)`)
        console.log(`   📧 ${userData.email}`)
      }
    } else {
      console.log(`📋 ${userData.prenom} ${userData.nom} (${userData.pseudo})`)
      console.log(`   📧 ${userData.email}`)
    }
  }

  // Utilisateurs bénévoles
  console.log('\n🙋 UTILISATEURS BÉNÉVOLES:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔒 Mot de passe pour tous: volunteer123\n')

  const volunteerUsers = [
    {
      email: 'marie.benevole@example.com',
      pseudo: 'MarieVolunteer',
      prenom: 'Marie',
      nom: 'Dupont',
    },
    { email: 'paul.aidant@example.com', pseudo: 'PaulHelper', prenom: 'Paul', nom: 'Lemoine' },
    {
      email: 'sophie.entraide@example.com',
      pseudo: 'SophieSupport',
      prenom: 'Sophie',
      nom: 'Bernard',
    },
    { email: 'lucas.engagement@example.com', pseudo: 'LucasCommit', prenom: 'Lucas', nom: 'Petit' },
    { email: 'emma.solidaire@example.com', pseudo: 'EmmaSolid', prenom: 'Emma', nom: 'Roux' },
    { email: 'thomas.devoue@example.com', pseudo: 'ThomasDevoted', prenom: 'Thomas', nom: 'Blanc' },
    { email: 'chloe.investie@example.com', pseudo: 'ChloeInvested', prenom: 'Chloé', nom: 'Lopez' },
    { email: 'alex.motive@example.com', pseudo: 'AlexMotiv', prenom: 'Alex', nom: 'Garcia' },
  ]

  for (const userData of volunteerUsers) {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: userData.email } })
      if (user) {
        console.log(`✅ ${user.prenom} ${user.nom} (${user.pseudo})`)
        console.log(`   📧 ${user.email}`)
      } else {
        console.log(`❌ ${userData.prenom} ${userData.nom} (non trouvé en BDD)`)
        console.log(`   📧 ${userData.email}`)
      }
    } else {
      console.log(`📋 ${userData.prenom} ${userData.nom} (${userData.pseudo})`)
      console.log(`   📧 ${userData.email}`)
    }
  }

  console.log("\n💡 Variables d'environnement pour personnaliser:")
  console.log('   - SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD')
  console.log('   - SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD')
  console.log('   - POWANGE_USER_EMAIL / POWANGE_USER_PASSWORD')

  if (prisma) {
    await prisma.$disconnect()
  }
}

listSeedAccounts().catch((error) => {
  console.error('Erreur:', error)
  process.exit(1)
})
