/**
 * Script de migration pour générer les tokens QR code pour les artistes existants
 *
 * Ce script génère un token unique pour chaque artiste qui n'en a pas encore
 *
 * Usage:
 * npx tsx scripts/generate-artist-qr-tokens.ts
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
  console.log('🚀 Début de la génération des tokens QR code pour les artistes...\n')

  // Récupérer tous les artistes sans token
  const artistsWithoutToken = await prisma.editionArtist.findMany({
    where: {
      qrCodeToken: null,
    },
    select: {
      id: true,
      user: {
        select: {
          prenom: true,
          nom: true,
          email: true,
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

  console.log(`📊 Nombre d'artistes sans token : ${artistsWithoutToken.length}`)

  if (artistsWithoutToken.length === 0) {
    console.log('✅ Tous les artistes ont déjà un token QR code')
    return
  }

  console.log('\n🔄 Génération des tokens...\n')

  let successCount = 0
  let errorCount = 0

  for (const artist of artistsWithoutToken) {
    try {
      // Générer un token unique
      let token = generateVolunteerQrCodeToken()

      // Vérifier l'unicité (très peu probable de collision, mais on vérifie quand même)
      let isUnique = false
      let attempts = 0
      const maxAttempts = 10

      while (!isUnique && attempts < maxAttempts) {
        const existing = await prisma.editionArtist.findUnique({
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

      // Mettre à jour l'artiste avec le token
      await prisma.editionArtist.update({
        where: { id: artist.id },
        data: { qrCodeToken: token },
      })

      const editionName =
        artist.edition.name || artist.edition.convention?.name || `Edition #${artist.edition.id}`

      console.log(`✅ Token généré pour ${artist.user.prenom} ${artist.user.nom} (${editionName})`)
      successCount++
    } catch (error) {
      console.error(
        `❌ Erreur pour l'artiste #${artist.id} (${artist.user.prenom} ${artist.user.nom}):`,
        error
      )
      errorCount++
    }
  }

  console.log('\n📈 Résumé:')
  console.log(`   ✅ Tokens générés avec succès: ${successCount}`)
  console.log(`   ❌ Erreurs: ${errorCount}`)
  console.log(`   📊 Total traité: ${artistsWithoutToken.length}`)

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
