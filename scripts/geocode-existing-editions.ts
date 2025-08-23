import { PrismaClient } from '@prisma/client'

import { geocodeEdition } from '../server/utils/geocoding'

const prisma = new PrismaClient()

// Configuration
const BATCH_SIZE = 5 // Nombre d'éditions à traiter en parallèle
const DELAY_BETWEEN_BATCHES = 2000 // Délai entre les batches en ms
const RETRY_ATTEMPTS = 3 // Nombre de tentatives en cas d'échec

// Fonction pour géocoder une édition avec retry
async function geocodeEditionWithRetry(
  edition: any,
  attempt: number = 1
): Promise<{ success: boolean; coords?: { latitude: number; longitude: number } }> {
  try {
    console.log(
      `🔍 [${attempt}/${RETRY_ATTEMPTS}] Géocodage de l'édition ${edition.id}: ${edition.name || 'Sans nom'} (${edition.city}, ${edition.country})`
    )

    const coords = await geocodeEdition({
      addressLine1: edition.addressLine1,
      addressLine2: edition.addressLine2,
      city: edition.city,
      postalCode: edition.postalCode,
      country: edition.country,
    })

    if (coords.latitude && coords.longitude) {
      return { success: true, coords }
    } else {
      console.log(`⚠️  Aucune coordonnée trouvée pour l'édition ${edition.id}`)
      return { success: false }
    }
  } catch (error) {
    console.error(`❌ Erreur tentative ${attempt} pour l'édition ${edition.id}:`, error)

    if (attempt < RETRY_ATTEMPTS) {
      console.log(`🔄 Nouvelle tentative dans 3 secondes...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return geocodeEditionWithRetry(edition, attempt + 1)
    }

    return { success: false }
  }
}

// Fonction pour traiter un batch d'éditions
async function processBatch(
  editions: any[],
  batchIndex: number
): Promise<{ success: number; errors: number }> {
  console.log(`\n📦 Traitement du batch ${batchIndex + 1} (${editions.length} éditions):`)

  const promises = editions.map(async (edition) => {
    const result = await geocodeEditionWithRetry(edition)

    if (result.success && result.coords) {
      try {
        await prisma.edition.update({
          where: { id: edition.id },
          data: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          },
        })

        console.log(
          `   ✅ Édition ${edition.id}: ${result.coords.latitude}, ${result.coords.longitude}`
        )
        return { success: true }
      } catch (dbError) {
        console.error(`   💾 Erreur DB pour l'édition ${edition.id}:`, dbError)
        return { success: false }
      }
    } else {
      console.log(`   ❌ Échec pour l'édition ${edition.id}`)
      return { success: false }
    }
  })

  const results = await Promise.all(promises)
  const success = results.filter((r) => r.success).length
  const errors = results.filter((r) => !r.success).length

  return { success, errors }
}

async function geocodeExistingEditions() {
  console.log('🗺️  Démarrage du géocodage des éditions existantes...')
  console.log(
    `⚙️  Configuration: ${BATCH_SIZE} éditions par batch, ${DELAY_BETWEEN_BATCHES}ms entre les batches`
  )

  try {
    // Récupérer toutes les éditions sans coordonnées
    const editions = await prisma.edition.findMany({
      where: {
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: {
        id: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
        name: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    console.log(`📍 ${editions.length} éditions à géocoder`)

    if (editions.length === 0) {
      console.log('🎉 Toutes les éditions ont déjà des coordonnées !')
      return
    }

    // Diviser en batches
    const batches: any[][] = []
    for (let i = 0; i < editions.length; i += BATCH_SIZE) {
      batches.push(editions.slice(i, i + BATCH_SIZE))
    }

    console.log(`📦 ${batches.length} batches à traiter`)

    let totalSuccess = 0
    let totalErrors = 0
    const startTime = Date.now()

    // Traiter chaque batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResult = await processBatch(batch, i)

      totalSuccess += batchResult.success
      totalErrors += batchResult.errors

      // Pause between batches (sauf pour le dernier)
      if (i < batches.length - 1) {
        console.log(`⏳ Pause de ${DELAY_BETWEEN_BATCHES}ms avant le prochain batch...`)
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)

    console.log(`\n🎯 RÉSULTATS FINAUX:`)
    console.log(
      `   ✅ Succès: ${totalSuccess}/${editions.length} (${Math.round((totalSuccess / editions.length) * 100)}%)`
    )
    console.log(
      `   ❌ Erreurs: ${totalErrors}/${editions.length} (${Math.round((totalErrors / editions.length) * 100)}%)`
    )
    console.log(`   ⏱️  Durée totale: ${duration}s`)
    console.log(
      `   ⚡ Moyenne: ${Math.round((editions.length / duration) * 10) / 10} éditions/seconde`
    )
  } catch (error) {
    console.error('💥 Erreur générale:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  geocodeExistingEditions()
    .then(() => {
      console.log('\n🎉 Géocodage terminé !')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error)
      process.exit(1)
    })
}

export { geocodeExistingEditions }
