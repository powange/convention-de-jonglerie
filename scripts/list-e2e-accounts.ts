import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL non définie')
  process.exit(1)
}

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
const prisma = new PrismaClient({ adapter })

const CLEANUP_FLAG = process.argv.includes('--clean')

async function listE2EAccounts() {
  try {
    const accounts = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e-test-' } },
      select: {
        id: true,
        email: true,
        pseudo: true,
        createdAt: true,
        isEmailVerified: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (accounts.length === 0) {
      console.log('✅ Aucun compte E2E trouvé en base de données')
      return
    }

    console.log(`🧪 ${accounts.length} compte(s) E2E trouvé(s) en base de données:\n`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    for (const account of accounts) {
      const verified = account.isEmailVerified ? '✅' : '❌'
      const date = account.createdAt.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
      console.log(`${verified} ${account.pseudo}`)
      console.log(`   📧 ${account.email}`)
      console.log(`   📅 Créé le ${date}`)
      console.log()
    }

    if (CLEANUP_FLAG) {
      console.log('🧹 Suppression des comptes E2E...')
      for (const account of accounts) {
        await prisma.user.delete({ where: { id: account.id } }).catch((e: Error) => {
          console.log(`⚠️  Impossible de supprimer ${account.email}: ${e.message}`)
        })
      }
      console.log('✅ Nettoyage terminé')
    } else {
      console.log('💡 Utiliser --clean pour supprimer ces comptes')
    }
  } finally {
    await prisma.$disconnect()
  }
}

listE2EAccounts().catch((error) => {
  console.error('Erreur:', error)
  process.exit(1)
})
