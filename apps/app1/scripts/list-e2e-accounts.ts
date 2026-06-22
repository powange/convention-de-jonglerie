import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const AUTH_DIR = path.join(ROOT_DIR, 'test-results', '.auth')

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

    // Conventions créées par les users E2E
    const accountIds = accounts.map((a) => a.id)
    const conventions =
      accountIds.length > 0
        ? await prisma.convention.findMany({
            where: { authorId: { in: accountIds } },
            select: {
              id: true,
              name: true,
              _count: { select: { editions: true } },
            },
          })
        : []

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

    if (conventions.length > 0) {
      console.log(`🏛️  ${conventions.length} convention(s) associée(s):`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      for (const conv of conventions) {
        console.log(`   📋 ${conv.name} (${conv._count.editions} édition(s))`)
      }
      console.log()
    }

    if (CLEANUP_FLAG) {
      // Supprimer les conventions d'abord (cascade → éditions et données liées)
      if (conventions.length > 0) {
        console.log('🧹 Suppression des conventions E2E...')
        for (const conv of conventions) {
          await prisma.convention.delete({ where: { id: conv.id } }).catch((e: Error) => {
            console.log(`⚠️  Impossible de supprimer la convention "${conv.name}": ${e.message}`)
          })
        }
        console.log(
          `   ✅ ${conventions.length} convention(s) supprimée(s) (+ éditions en cascade)`
        )
      }

      // Puis supprimer les users
      console.log('🧹 Suppression des comptes E2E...')
      for (const account of accounts) {
        await prisma.user.delete({ where: { id: account.id } }).catch((e: Error) => {
          console.log(`⚠️  Impossible de supprimer ${account.email}: ${e.message}`)
        })
      }
      console.log(`   ✅ ${accounts.length} compte(s) supprimé(s)`)

      // Nettoyer les fichiers d'état Playwright
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR)
        for (const file of files) {
          fs.unlinkSync(path.join(AUTH_DIR, file))
        }
        console.log(`🗑️  ${files.length} fichier(s) supprimé(s) dans test-results/.auth/`)
      }

      console.log('\n✅ Nettoyage terminé')
    } else {
      console.log('💡 Utiliser --clean pour supprimer ces comptes et leurs conventions')
    }
  } finally {
    await prisma.$disconnect()
  }
}

listE2EAccounts().catch((error) => {
  console.error('Erreur:', error)
  process.exit(1)
})
