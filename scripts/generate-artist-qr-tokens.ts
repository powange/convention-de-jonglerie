/**
 * Script de migration pour générer les tokens QR code pour les artistes existants
 *
 * Ce script génère un token unique pour chaque artiste qui n'en a pas encore
 *
 * Usage:
 * npx tsx scripts/generate-artist-qr-tokens.ts
 */

import { PrismaClient } from '@prisma/client'

import { generateVolunteerQrCodeToken } from '../server/utils/token-generator'

const prisma = new PrismaClient()

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
