/**
 * Script de vérification des tokens QR code des bénévoles
 *
 * Affiche un rapport sur l'état des tokens des bénévoles acceptés
 *
 * Usage:
 * npx tsx scripts/check-volunteer-tokens.ts
 */

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

async function main() {
  console.log('🔍 Vérification des tokens QR code des bénévoles...\n')

  // Compter tous les bénévoles acceptés
  const totalAccepted = await prisma.editionVolunteerApplication.count({
    where: {
      status: 'ACCEPTED',
    },
  })

  // Compter les bénévoles avec token
  const withToken = await prisma.editionVolunteerApplication.count({
    where: {
      status: 'ACCEPTED',
      qrCodeToken: {
        not: null,
      },
    },
  })

  // Compter les bénévoles sans token
  const withoutToken = totalAccepted - withToken

  console.log('📊 Résumé:')
  console.log(`   Total de bénévoles acceptés: ${totalAccepted}`)
  console.log(`   ✅ Avec token QR code: ${withToken}`)
  console.log(`   ❌ Sans token QR code: ${withoutToken}`)

  if (withoutToken > 0) {
    console.log(`\n⚠️  Il reste ${withoutToken} bénévole${withoutToken > 1 ? 's' : ''} sans token.`)
    console.log('   Exécutez: npx tsx scripts/generate-volunteer-qr-tokens.ts')
  } else {
    console.log('\n🎉 Tous les bénévoles ont un token QR code sécurisé!')
  }

  // Afficher quelques exemples
  if (withToken > 0) {
    console.log('\n📋 Exemples de QR codes (3 premiers):')
    const examples = await prisma.editionVolunteerApplication.findMany({
      where: {
        status: 'ACCEPTED',
        qrCodeToken: {
          not: null,
        },
      },
      select: {
        id: true,
        qrCodeToken: true,
        user: {
          select: {
            prenom: true,
            nom: true,
          },
        },
        edition: {
          select: {
            id: true,
            name: true,
            convention: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 3,
    })

    examples.forEach((volunteer) => {
      const editionName =
        volunteer.edition.name ||
        volunteer.edition.convention?.name ||
        `Edition #${volunteer.edition.id}`
      const qrCode = `volunteer-${volunteer.id}-${volunteer.qrCodeToken}`
      console.log(`   • ${volunteer.user.prenom} ${volunteer.user.nom} (${editionName})`)
      console.log(`     QR Code: ${qrCode}`)
    })
  }
}

main()
  .catch((error) => {
    console.error('💥 Erreur:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
