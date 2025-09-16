#!/usr/bin/env node
/**
 * Script de migration pour migrer les assignations d'équipes
 * depuis le champ JSON assignedTeams vers les nouvelles relations
 * avec la table VolunteerTeam
 *
 * Usage: npx tsx scripts/migrate-team-assignments.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateTeamAssignments() {
  console.log("🚀 Début de la migration des assignations d'équipes...\n")

  try {
    // Récupérer toutes les candidatures qui ont des équipes assignées
    const applications = await prisma.editionVolunteerApplication.findMany({
      where: {
        assignedTeams: { not: null },
      },
      include: {
        edition: {
          select: {
            id: true,
            name: true,
            volunteersMode: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        teams: true, // Relations existantes avec VolunteerTeam
      },
    })

    console.log(`📊 ${applications.length} candidatures avec des équipes assignées trouvées.\n`)

    let totalAssignmentsMigrated = 0
    let totalApplicationsProcessed = 0

    for (const application of applications) {
      console.log(
        `\n📝 Traitement de la candidature ${application.id} (${application.user.email}) pour l'édition "${application.edition.name}"...`
      )

      // Parse le JSON des équipes assignées
      let assignedTeamNames: string[] = []

      try {
        if (typeof application.assignedTeams === 'string') {
          assignedTeamNames = JSON.parse(application.assignedTeams)
        } else if (Array.isArray(application.assignedTeams)) {
          assignedTeamNames = application.assignedTeams as string[]
        }
      } catch (error) {
        console.error(
          `  ❌ Erreur lors du parsing du JSON pour la candidature ${application.id}:`,
          error
        )
        continue
      }

      if (!Array.isArray(assignedTeamNames) || assignedTeamNames.length === 0) {
        console.log(`  ⏭️  Aucune équipe assignée à migrer pour cette candidature.`)
        continue
      }

      console.log(`  📋 Équipes assignées trouvées: ${assignedTeamNames.join(', ')}`)

      // Vérifier si des assignations ont déjà été migrées
      if (application.teams.length > 0) {
        console.log(
          `  ℹ️  Cette candidature a déjà ${application.teams.length} équipes dans les nouvelles relations.`
        )

        // Récupérer les noms des équipes déjà assignées via les nouvelles relations
        const existingTeamNames = application.teams.map((t) => t.name.toLowerCase())

        // Filtrer les équipes qui n'ont pas encore été migrées
        assignedTeamNames = assignedTeamNames.filter(
          (teamName) => teamName && !existingTeamNames.includes(teamName.toLowerCase().trim())
        )

        if (assignedTeamNames.length === 0) {
          console.log(`  ✅ Toutes les équipes ont déjà été migrées.`)
          continue
        }
        console.log(`  📋 ${assignedTeamNames.length} nouvelles équipes à migrer.`)
      }

      // Récupérer les équipes existantes dans la nouvelle table pour cette édition
      const volunteerTeams = await prisma.volunteerTeam.findMany({
        where: {
          editionId: application.edition.id,
        },
      })

      const volunteerTeamsByName = new Map(
        volunteerTeams.map((team) => [team.name.toLowerCase().trim(), team])
      )

      let assignmentsMigratedForApplication = 0

      for (const teamName of assignedTeamNames) {
        if (!teamName || teamName.trim() === '') {
          continue
        }

        const normalizedTeamName = teamName.toLowerCase().trim()
        const volunteerTeam = volunteerTeamsByName.get(normalizedTeamName)

        if (!volunteerTeam) {
          console.log(`  ⚠️  Équipe "${teamName}" introuvable dans la nouvelle table, ignorée.`)
          continue
        }

        try {
          // Créer la relation entre la candidature et l'équipe
          await prisma.editionVolunteerApplication.update({
            where: { id: application.id },
            data: {
              teams: {
                connect: { id: volunteerTeam.id },
              },
            },
          })

          console.log(`  ✅ Assignation créée pour l'équipe "${volunteerTeam.name}"`)
          assignmentsMigratedForApplication++
          totalAssignmentsMigrated++
        } catch (error) {
          // Ignorer les erreurs de contrainte unique (assignation déjà existante)
          if (error.code === 'P2002') {
            console.log(`  ℹ️  Assignation déjà existante pour l'équipe "${volunteerTeam.name}"`)
          } else {
            console.error(
              `  ❌ Erreur lors de la création de l'assignation pour l'équipe "${teamName}":`,
              error
            )
          }
        }
      }

      if (assignmentsMigratedForApplication > 0) {
        console.log(
          `  ✨ ${assignmentsMigratedForApplication} assignations migrées pour cette candidature.`
        )
        totalApplicationsProcessed++

        // Optionnel : On pourrait supprimer le champ JSON après migration
        // Mais on le garde pour l'instant comme backup
        /*
        await prisma.editionVolunteerApplication.update({
          where: { id: application.id },
          data: { assignedTeams: null }
        })
        console.log(`  🧹 Champ JSON nettoyé pour cette candidature.`)
        */
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log(`\n✅ Migration terminée avec succès !`)
    console.log(`   - ${totalApplicationsProcessed} candidatures traitées`)
    console.log(`   - ${totalAssignmentsMigrated} assignations d'équipes migrées au total\n`)

    // Afficher un résumé des assignations créées
    const assignmentCounts = await prisma.editionVolunteerApplication.groupBy({
      by: ['editionId'],
      where: {
        teams: {
          some: {},
        },
      },
      _count: {
        id: true,
      },
    })

    console.log('📊 Résumé par édition:')
    for (const count of assignmentCounts) {
      const edition = await prisma.edition.findUnique({
        where: { id: count.editionId },
        select: { name: true },
      })
      console.log(
        `   - ${edition?.name}: ${count._count.id} candidatures avec des assignations d'équipes`
      )
    }

    // Statistiques détaillées
    const totalAssignments = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM _EditionVolunteerApplicationToVolunteerTeam
    `

    console.log(
      `\n📈 Total d'assignations d'équipes dans la nouvelle structure: ${totalAssignments[0].count}`
    )
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la migration
migrateTeamAssignments().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
