import { PrismaClient } from '@prisma/client'

import { createVolunteerMealSelections } from '../server/utils/volunteer-meals'

const prisma = new PrismaClient()

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
        editionId: true,
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

        await createVolunteerMealSelections(volunteer.id, volunteer.editionId)

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
