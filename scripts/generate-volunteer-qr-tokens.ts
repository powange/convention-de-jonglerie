/**
 * Script de migration pour générer les tokens QR code pour les bénévoles existants
 *
 * Ce script génère un token unique pour chaque bénévole qui n'en a pas encore
 *
 * Usage:
 * npx tsx scripts/generate-volunteer-qr-tokens.ts
 */

import { PrismaClient } from '@prisma/client'

import { generateVolunteerQrCodeToken } from '../server/utils/token-generator'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Début de la génération des tokens QR code pour les bénévoles...\n')

  // Récupérer tous les bénévoles sans token
  const volunteersWithoutToken = await prisma.editionVolunteerApplication.findMany({
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

  console.log(`📊 Nombre de bénévoles sans token : ${volunteersWithoutToken.length}`)

  if (volunteersWithoutToken.length === 0) {
    console.log('✅ Tous les bénévoles ont déjà un token QR code')
    return
  }

  console.log('\n🔄 Génération des tokens...\n')

  let successCount = 0
  let errorCount = 0

  for (const volunteer of volunteersWithoutToken) {
    try {
      // Générer un token unique
      let token = generateVolunteerQrCodeToken()

      // Vérifier l'unicité (très peu probable de collision, mais on vérifie quand même)
      let isUnique = false
      let attempts = 0
      const maxAttempts = 10

      while (!isUnique && attempts < maxAttempts) {
        const existing = await prisma.editionVolunteerApplication.findUnique({
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

      // Mettre à jour le bénévole avec le token
      await prisma.editionVolunteerApplication.update({
        where: { id: volunteer.id },
        data: { qrCodeToken: token },
      })

      const editionName =
        volunteer.edition.name ||
        volunteer.edition.convention?.name ||
        `Edition #${volunteer.edition.id}`

      console.log(
        `✅ Token généré pour ${volunteer.user.prenom} ${volunteer.user.nom} (${editionName})`
      )
      successCount++
    } catch (error) {
      console.error(
        `❌ Erreur pour le bénévole #${volunteer.id} (${volunteer.user.prenom} ${volunteer.user.nom}):`,
        error
      )
      errorCount++
    }
  }

  console.log('\n📈 Résumé:')
  console.log(`   ✅ Tokens générés avec succès: ${successCount}`)
  console.log(`   ❌ Erreurs: ${errorCount}`)
  console.log(`   📊 Total traité: ${volunteersWithoutToken.length}`)

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
