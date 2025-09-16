#!/usr/bin/env node
/**
 * Script pour migrer les teamPreferences des candidatures de bénévoles
 * de noms d'équipes vers les IDs du nouveau système VolunteerTeam
 *
 * Usage: npx tsx scripts/migrate-team-preferences.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateTeamPreferences() {
  console.log("🔄 Migration des préférences d'équipes des candidatures...")
  console.log('='.repeat(70))

  try {
    // 1. Récupérer toutes les candidatures avec des teamPreferences
    const applicationsWithPreferences = await prisma.editionVolunteerApplication.findMany({
      where: {
        teamPreferences: { not: null },
      },
      include: {
        edition: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            prenom: true,
            nom: true,
          },
        },
      },
      orderBy: [{ editionId: 'asc' }, { id: 'asc' }],
    })

    if (applicationsWithPreferences.length === 0) {
      console.log("\n✅ Aucune candidature avec des préférences d'équipes à migrer.")
      return
    }

    console.log(
      `\n📋 ${applicationsWithPreferences.length} candidatures trouvées avec des préférences d'équipes\n`
    )

    let totalMigrated = 0
    let totalErrors = 0
    let currentEditionId: number | null = null

    for (const application of applicationsWithPreferences) {
      // Afficher l'en-tête d'édition
      if (application.edition.id !== currentEditionId) {
        currentEditionId = application.edition.id
        console.log(`\n🏢 Édition: "${application.edition.name}" (ID: ${application.edition.id})`)
        console.log('-'.repeat(50))
      }

      // Parser les préférences actuelles
      let teamNames: string[] = []
      try {
        if (typeof application.teamPreferences === 'string') {
          teamNames = JSON.parse(application.teamPreferences)
        } else if (Array.isArray(application.teamPreferences)) {
          teamNames = application.teamPreferences
        }
      } catch (error) {
        console.log(`  ❌ Candidature ${application.id}: Erreur parsing JSON`)
        totalErrors++
        continue
      }

      if (!Array.isArray(teamNames) || teamNames.length === 0) {
        console.log(`  ⏭️  Candidature ${application.id}: Pas de préférences à migrer`)
        continue
      }

      // Récupérer les équipes de cette édition
      const volunteerTeams = await prisma.volunteerTeam.findMany({
        where: { editionId: application.edition.id },
        select: { id: true, name: true },
      })

      if (volunteerTeams.length === 0) {
        console.log(
          `  ⚠️  Candidature ${application.id}: Aucune équipe VolunteerTeam trouvée pour cette édition`
        )
        totalErrors++
        continue
      }

      // Mapper les noms vers les IDs
      const teamIds: string[] = []
      const missingTeams: string[] = []

      for (const teamName of teamNames) {
        if (!teamName || teamName.trim() === '') continue

        const normalizedName = teamName.toLowerCase().trim()
        const matchingTeam = volunteerTeams.find(
          (t) => t.name.toLowerCase().trim() === normalizedName
        )

        if (matchingTeam) {
          teamIds.push(matchingTeam.id)
        } else {
          missingTeams.push(teamName)
        }
      }

      // Afficher les détails de la migration
      console.log(`  📝 Candidature ${application.id} - ${application.user.email}`)
      console.log(`     Ancien: [${teamNames.join(', ')}]`)

      if (missingTeams.length > 0) {
        console.log(`     ⚠️  Équipes introuvables: [${missingTeams.join(', ')}]`)
      }

      if (teamIds.length === 0) {
        console.log(`     ❌ Aucune équipe valide trouvée - migration annulée`)
        totalErrors++
        continue
      }

      console.log(`     Nouveau: [${teamIds.join(', ')}]`)

      // Déterminer s'il faut migrer
      const currentIdsString = JSON.stringify(teamIds.sort())
      const originalPrefsString = JSON.stringify(teamNames.sort())

      // Vérifier si c'est déjà migré (si ce sont déjà des IDs)
      const alreadyMigrated = teamNames.every((name) =>
        volunteerTeams.some((team) => team.id === name)
      )

      if (alreadyMigrated) {
        console.log(`     ✅ Déjà migré`)
        continue
      }

      // Effectuer la migration
      try {
        await prisma.editionVolunteerApplication.update({
          where: { id: application.id },
          data: {
            teamPreferences: teamIds,
          },
        })

        console.log(`     ✅ Migré avec succès`)
        totalMigrated++
      } catch (error) {
        console.log(`     ❌ Erreur lors de la migration: ${error}`)
        totalErrors++
      }
    }

    // Statistiques finales
    console.log('\n' + '='.repeat(70))
    console.log('📊 RÉSUMÉ DE LA MIGRATION')
    console.log('='.repeat(70))
    console.log(`📋 Candidatures examinées: ${applicationsWithPreferences.length}`)
    console.log(`✅ Candidatures migrées: ${totalMigrated}`)
    console.log(`❌ Erreurs: ${totalErrors}`)

    if (totalMigrated > 0) {
      console.log(`\n🎉 Migration terminée avec succès !`)
    } else if (totalErrors === 0) {
      console.log(`\n✅ Aucune migration nécessaire - tout est déjà à jour`)
    } else {
      console.log(`\n⚠️  Migration terminée avec des erreurs`)
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la migration
migrateTeamPreferences().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
