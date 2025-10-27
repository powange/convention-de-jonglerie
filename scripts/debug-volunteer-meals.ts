import { PrismaClient } from '@prisma/client'

import {
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
} from '../server/utils/volunteer-meals.js'

const prisma = new PrismaClient()

async function debugVolunteerMeals(volunteerId: number) {
  console.log(`🔍 Diagnostic pour le bénévole ID ${volunteerId}\n`)

  // Récupérer le bénévole
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    include: {
      user: {
        select: {
          pseudo: true,
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
      mealSelections: {
        include: {
          meal: true,
        },
      },
    },
  })

  if (!volunteer) {
    console.log('❌ Bénévole introuvable')
    return
  }

  console.log('👤 Bénévole:', volunteer.user.pseudo)
  console.log('📧 Email:', volunteer.user.email)
  console.log('🎪 Édition:', volunteer.edition.convention.name, '-', volunteer.edition.name)
  console.log('✅ Statut:', volunteer.status)
  console.log('\n📅 Disponibilités:')
  console.log('   - Setup:', volunteer.setupAvailability ? '✅' : '❌')
  console.log('   - Event:', volunteer.eventAvailability ? '✅' : '❌')
  console.log('   - Teardown:', volunteer.teardownAvailability ? '✅' : '❌')
  console.log('\n📍 Dates:')
  console.log('   - Arrivée:', volunteer.arrivalDateTime || 'Non renseignée')
  console.log('   - Départ:', volunteer.departureDateTime || 'Non renseignée')

  // Analyser les dates si renseignées
  if (volunteer.arrivalDateTime) {
    const [arrivalDate, arrivalTime] = volunteer.arrivalDateTime.split('_')
    console.log(
      `     → Date: ${arrivalDate}, Moment: ${arrivalTime}, Repas disponibles: ${getAvailableMealsOnArrival(arrivalTime).join(', ')}`
    )
  }
  if (volunteer.departureDateTime) {
    const [departureDate, departureTime] = volunteer.departureDateTime.split('_')
    console.log(
      `     → Date: ${departureDate}, Moment: ${departureTime}, Repas disponibles: ${getAvailableMealsOnDeparture(departureTime).join(', ')}`
    )
  }

  console.log('\n🍽️  Sélections de repas actuelles:', volunteer.mealSelections.length)
  if (volunteer.mealSelections.length > 0) {
    volunteer.mealSelections.forEach((selection) => {
      console.log(
        `   - ${selection.meal.date} - ${selection.meal.mealType} (${selection.meal.phase}) - Accepté: ${selection.accepted ? '✅' : '❌'}`
      )
    })
  }

  // Récupérer tous les repas activés pour l'édition
  const allMeals = await prisma.volunteerMeal.findMany({
    where: {
      editionId: volunteer.editionId,
      enabled: true,
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  console.log("\n🍽️  Repas activés pour l'édition:", allMeals.length)

  if (allMeals.length === 0) {
    console.log('⚠️  PROBLÈME: Aucun repas activé pour cette édition!')
    return
  }

  // Analyser chaque repas
  console.log("\n📊 Analyse de l'éligibilité pour chaque repas:")
  allMeals.forEach((meal) => {
    const reasons: string[] = []

    // Filtrer par phase
    let eligible = true
    if (meal.phase === 'SETUP' && !volunteer.setupAvailability) {
      eligible = false
      reasons.push('Setup non disponible')
    }
    if (meal.phase === 'TEARDOWN' && !volunteer.teardownAvailability) {
      eligible = false
      reasons.push('Teardown non disponible')
    }
    if (meal.phase === 'EVENT' && !volunteer.eventAvailability) {
      eligible = false
      reasons.push('Event non disponible')
    }

    // Filtrer par dates
    const mealDate = new Date(meal.date)
    mealDate.setUTCHours(0, 0, 0, 0)

    if (volunteer.arrivalDateTime) {
      const [arrivalDatePart, arrivalTimeOfDay] = volunteer.arrivalDateTime.split('_')
      const arrivalDate = new Date(arrivalDatePart)
      arrivalDate.setUTCHours(0, 0, 0, 0)

      if (mealDate < arrivalDate) {
        eligible = false
        reasons.push('Avant arrivée')
      } else if (mealDate.getTime() === arrivalDate.getTime()) {
        const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
        if (!availableMeals.includes(meal.mealType)) {
          eligible = false
          reasons.push(`Arrivée trop tard (${arrivalTimeOfDay})`)
        }
      }
    }

    if (volunteer.departureDateTime) {
      const [departureDatePart, departureTimeOfDay] = volunteer.departureDateTime.split('_')
      const departureDate = new Date(departureDatePart)
      departureDate.setUTCHours(0, 0, 0, 0)

      if (mealDate > departureDate) {
        eligible = false
        reasons.push('Après départ')
      } else if (mealDate.getTime() === departureDate.getTime()) {
        const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
        if (!availableMeals.includes(meal.mealType)) {
          eligible = false
          reasons.push(`Départ trop tôt (${departureTimeOfDay})`)
        }
      }
    }

    const status = eligible ? '✅' : '❌'
    const reasonStr = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
    console.log(`   ${status} ${meal.date} - ${meal.mealType} (${meal.phase})${reasonStr}`)
  })
}

// Exécuter
const volunteerId = parseInt(process.argv[2] || '4')
debugVolunteerMeals(volunteerId)
  .then(() => {
    console.log('\n✨ Diagnostic terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur:', error)
    process.exit(1)
  })
