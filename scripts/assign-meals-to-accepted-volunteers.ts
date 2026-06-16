/**
 * Script pour assigner automatiquement les repas aux bénévoles acceptés
 *
 * ⚠️ IMPORTANT: Ce script ne fonctionne QU'EN DÉVELOPPEMENT LOCAL
 *
 * En production, utilisez plutôt la route API :
 * POST /api/admin/assign-meals-volunteers
 *
 * Via l'interface admin :
 * - Accédez à /admin
 * - Cliquez sur la carte "Repas bénévoles"
 *
 * Via cURL en production :
 * curl -X POST https://your-domain.com/api/admin/assign-meals-volunteers \
 *   -H "Cookie: nuxt-session=YOUR_ADMIN_SESSION" \
 *   -H "Content-Type: application/json"
 */

import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../server/generated/prisma/client'
import { createVolunteerMealSelections } from '../server/utils/volunteer-meals.js'

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

async function assignMealsToAcceptedVolunteers() {
  console.log('🍽️  Recherche des bénévoles acceptés sans repas...\n')

  try {
    // Récupérer tous les bénévoles avec statut ACCEPTED
    const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        status: 'ACCEPTED',
      },
      select: {
        id: true,
        eventId: true,
        user: {
          select: {
            pseudo: true,
            email: true,
          },
        },
        edition: {
          select: {
            name: true,
            convention: {
              select: {
                name: true,
              },
            },
          },
        },
        mealSelections: {
          select: {
            id: true,
          },
        },
      },
    })

    console.log(`✅ Trouvé ${acceptedVolunteers.length} bénévole(s) accepté(s)\n`)

    // Filtrer ceux qui n'ont aucune sélection de repas
    const volunteersWithoutMeals = acceptedVolunteers.filter((v) => v.mealSelections.length === 0)

    if (volunteersWithoutMeals.length === 0) {
      console.log('✨ Tous les bénévoles acceptés ont déjà des sélections de repas !')
      return
    }

    console.log(`📋 ${volunteersWithoutMeals.length} bénévole(s) sans sélections de repas\n`)

    let successCount = 0
    let errorCount = 0

    // Traiter chaque bénévole
    for (const volunteer of volunteersWithoutMeals) {
      const editionName = volunteer.edition.name
        ? `${volunteer.edition.convention.name} - ${volunteer.edition.name}`
        : volunteer.edition.convention.name

      try {
        console.log(
          `⏳ Traitement: ${volunteer.user.pseudo} (${volunteer.user.email}) - ${editionName}`
        )

        // eventId == editionId (invariant étape 0) : createVolunteerMealSelections attend l'id d'édition
        await createVolunteerMealSelections(volunteer.id, volunteer.eventId)

        console.log(`   ✅ Repas assignés avec succès\n`)
        successCount++
      } catch (error) {
        console.error(`   ❌ Erreur:`, error)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Résumé:')
    console.log(`   ✅ Succès: ${successCount}`)
    console.log(`   ❌ Erreurs: ${errorCount}`)
    console.log(`   📝 Total traité: ${volunteersWithoutMeals.length}`)
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error("❌ Erreur lors de l'exécution du script:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script
assignMealsToAcceptedVolunteers()
  .then(() => {
    console.log('✨ Script terminé avec succès !')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
