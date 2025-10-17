/**
 * Script de migration pour convertir les anciennes notifications
 * vers le nouveau système hybride de traduction
 *
 * Ce script migre les notifications existantes qui utilisent
 * les anciens champs (title, message, actionText) vers les nouveaux
 * champs de texte libre (titleText, messageText, actionText)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Début de la migration des notifications...')

  try {
    // Récupérer toutes les notifications existantes
    const notifications = await prisma.notification.findMany({
      select: {
        id: true,
        // Les anciens champs n'existent plus dans le schéma Prisma
        // mais ils peuvent encore exister dans la base de données
      },
    })

    console.log(`📊 ${notifications.length} notifications trouvées`)

    if (notifications.length === 0) {
      console.log('✅ Aucune notification à migrer')
      return
    }

    // Migrer les notifications par lots
    let migratedCount = 0
    let errorCount = 0

    for (const notification of notifications) {
      try {
        // Utiliser une requête SQL brute pour migrer les données
        // car les anciens champs ne sont plus dans le schéma TypeScript
        await prisma.$executeRaw`
          UPDATE Notification
          SET
            titleText = title,
            messageText = message,
            actionText = actionText
          WHERE id = ${notification.id}
            AND title IS NOT NULL
            AND titleText IS NULL
        `

        migratedCount++

        if (migratedCount % 100 === 0) {
          console.log(`⏳ ${migratedCount} notifications migrées...`)
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la migration de ${notification.id}:`, error)
        errorCount++
      }
    }

    console.log('\n📈 Résumé de la migration:')
    console.log(`  ✅ Migrées avec succès: ${migratedCount}`)
    console.log(`  ❌ Erreurs: ${errorCount}`)
    console.log(`  📊 Total: ${notifications.length}`)

    // Optionnel: Supprimer les anciens champs après migration
    console.log(
      '\n⚠️  Note: Les anciens champs (title, message, actionText) peuvent être supprimés'
    )
    console.log('   de la base de données une fois la migration vérifiée.')
    console.log('   Pour cela, vous devrez créer une nouvelle migration Prisma.')

    console.log('\n✅ Migration terminée avec succès!')
  } catch (error) {
    console.error('❌ Erreur fatale lors de la migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('💥 Erreur non gérée:', error)
  process.exit(1)
})
