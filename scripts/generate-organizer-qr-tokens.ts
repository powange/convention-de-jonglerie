/**
 * Script de migration pour générer les tokens QR code pour les organisateurs d'édition existants
 *
 * Ce script génère un token unique pour chaque organisateur qui n'en a pas encore
 *
 * Usage:
 * npx tsx scripts/generate-organizer-qr-tokens.ts
 */

import { randomBytes } from 'crypto'

import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'

// Fonction de génération de token (copie locale pour éviter les problèmes d'imports avec tsx)
function generateVolunteerQrCodeToken(): string {
  return randomBytes(16).toString('hex') // 16 bytes = 32 hex chars
}

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
  console.log('🚀 Début de la génération des tokens QR code pour les organisateurs...\n')

  // Récupérer tous les organisateurs sans token
  const organizersWithoutToken = await prisma.editionOrganizer.findMany({
    where: {
      qrCodeToken: null,
    },
    select: {
      id: true,
      organizer: {
        select: {
          user: {
            select: {
              prenom: true,
              nom: true,
              email: true,
            },
          },
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
  })

  console.log(`📊 Nombre d'organisateurs sans token : ${organizersWithoutToken.length}`)

  if (organizersWithoutToken.length === 0) {
    console.log('✅ Tous les organisateurs ont déjà un token QR code')
    return
  }

  console.log('\n🔄 Génération des tokens...\n')

  let successCount = 0
  let errorCount = 0

  for (const organizer of organizersWithoutToken) {
    try {
      // Générer un token unique
      let token = generateVolunteerQrCodeToken()

      // Vérifier l'unicité (très peu probable de collision, mais on vérifie quand même)
      let isUnique = false
      let attempts = 0
      const maxAttempts = 10

      while (!isUnique && attempts < maxAttempts) {
        const existing = await prisma.editionOrganizer.findUnique({
          where: { qrCodeToken: token },
        })

        if (!existing) {
          isUnique = true
        } else {
          console.warn(`⚠️  Token collision détectée, régénération...`)
          token = generateVolunteerQrCodeToken()
          attempts++
        }
      }

      if (!isUnique) {
        throw new Error(`Impossible de générer un token unique après ${maxAttempts} tentatives`)
      }

      // Mettre à jour l'organisateur avec le token
      await prisma.editionOrganizer.update({
        where: { id: organizer.id },
        data: { qrCodeToken: token },
      })

      const editionName =
        organizer.edition.name ||
        organizer.edition.convention?.name ||
        `Edition #${organizer.edition.id}`

      console.log(
        `✅ Token généré pour ${organizer.organizer.user.prenom} ${organizer.organizer.user.nom} (${editionName})`
      )
      successCount++
    } catch (error) {
      console.error(
        `❌ Erreur pour l'organisateur #${organizer.id} (${organizer.organizer.user.prenom} ${organizer.organizer.user.nom}):`,
        error
      )
      errorCount++
    }
  }

  console.log('\n📈 Résumé:')
  console.log(`   ✅ Tokens générés avec succès: ${successCount}`)
  console.log(`   ❌ Erreurs: ${errorCount}`)
  console.log(`   📊 Total traité: ${organizersWithoutToken.length}`)

  if (errorCount === 0) {
    console.log('\n🎉 Migration terminée avec succès!')
  } else {
    console.log(`\n⚠️  Migration terminée avec ${errorCount} erreur${errorCount > 1 ? 's' : ''}`)
  }
}

main()
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
