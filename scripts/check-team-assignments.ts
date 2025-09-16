#!/usr/bin/env node
/**
 * Script pour vérifier les assignations d'équipes existantes
 * dans le JSON et dans les nouvelles relations
 *
 * Usage: npx tsx scripts/check-team-assignments.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTeamAssignments() {
  console.log("🔍 Vérification des assignations d'équipes...\n")

  try {
    // 1. Vérifier les candidatures avec des équipes dans le JSON
    const applicationsWithJSON = await prisma.editionVolunteerApplication.findMany({
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
            email: true,
            prenom: true,
            nom: true,
          },
        },
      },
    })

    console.log('📋 Candidatures avec des équipes dans le JSON:')
    console.log('='.repeat(70))

    for (const application of applicationsWithJSON) {
      console.log(`\nCandidature ID: ${application.id}`)
      console.log(
        `Utilisateur: ${application.user.email} (${application.user.prenom} ${application.user.nom})`
      )
      console.log(`Édition: "${application.edition.name}" (ID: ${application.edition.id})`)
      console.log(`Statut: ${application.status}`)

      let teamNames = []
      try {
        if (typeof application.assignedTeams === 'string') {
          teamNames = JSON.parse(application.assignedTeams)
        } else if (Array.isArray(application.assignedTeams)) {
          teamNames = application.assignedTeams
        }
      } catch (error) {
        console.log('  ❌ Erreur lors du parsing du JSON')
        continue
      }

      if (Array.isArray(teamNames) && teamNames.length > 0) {
        console.log(`  Équipes assignées (${teamNames.length}): ${teamNames.join(', ')}`)
      } else {
        console.log('  Aucune équipe trouvée dans le JSON')
      }
    }

    // 2. Vérifier les assignations dans les nouvelles relations
    console.log('\n\n📊 Assignations dans les nouvelles relations:')
    console.log('='.repeat(70))

    const applicationsWithRelations = await prisma.editionVolunteerApplication.findMany({
      where: {
        teams: {
          some: {},
        },
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
        teams: {
          select: {
            id: true,
            name: true,
            color: true,
            maxVolunteers: true,
          },
        },
      },
      orderBy: [{ editionId: 'asc' }, { id: 'asc' }],
    })

    if (applicationsWithRelations.length === 0) {
      console.log('\nAucune assignation dans les nouvelles relations.')
    } else {
      let currentEditionId: number | null = null

      for (const application of applicationsWithRelations) {
        if (application.edition.id !== currentEditionId) {
          currentEditionId = application.edition.id
          console.log(`\nÉdition: "${application.edition.name}" (ID: ${application.edition.id})`)
        }

        console.log(
          `  Candidature ${application.id} - ${application.user.email} (${application.status})`
        )
        for (const team of application.teams) {
          console.log(`    - ${team.name} (ID: ${team.id}, couleur: ${team.color})`)
        }
      }
    }

    // 3. Statistiques
    console.log('\n\n📈 Statistiques:')
    console.log('='.repeat(70))

    const totalApplicationsWithJSON = applicationsWithJSON.filter((app) => {
      try {
        const teams =
          typeof app.assignedTeams === 'string' ? JSON.parse(app.assignedTeams) : app.assignedTeams
        return Array.isArray(teams) && teams.length > 0
      } catch {
        return false
      }
    }).length

    const totalApplicationsWithRelations = applicationsWithRelations.length
    const editionsWithAssignments = new Set(applicationsWithRelations.map((app) => app.edition.id))
      .size

    console.log(`\n  📋 Candidatures avec équipes dans JSON: ${totalApplicationsWithJSON}`)
    console.log(
      `  📊 Candidatures avec équipes dans les nouvelles relations: ${totalApplicationsWithRelations}`
    )
    console.log(`  🏢 Éditions avec des assignations d'équipes: ${editionsWithAssignments}`)

    // Compter le total d'assignations
    const totalAssignments = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM _EditionVolunteerApplicationToVolunteerTeam
    `

    console.log(`  🔗 Total d'assignations d'équipes (relations): ${totalAssignments[0].count}`)

    if (totalApplicationsWithJSON > totalApplicationsWithRelations) {
      console.log(
        `\n  ⚠️  ${totalApplicationsWithJSON - totalApplicationsWithRelations} candidatures ont des équipes à migrer`
      )
      console.log(`     Exécutez 'npx tsx scripts/migrate-team-assignments.ts' pour migrer`)
    } else {
      console.log(`\n  ✅ Toutes les candidatures semblent avoir été migrées`)
    }

    // 4. Vérifier les incohérences (équipes dans JSON qui n'existent plus dans VolunteerTeam)
    console.log('\n\n🔍 Vérification des incohérences:')
    console.log('='.repeat(70))

    let inconsistenciesFound = 0

    for (const application of applicationsWithJSON) {
      let teamNames = []
      try {
        if (typeof application.assignedTeams === 'string') {
          teamNames = JSON.parse(application.assignedTeams)
        } else if (Array.isArray(application.assignedTeams)) {
          teamNames = application.assignedTeams
        }
      } catch {
        continue
      }

      if (!Array.isArray(teamNames) || teamNames.length === 0) continue

      const volunteerTeams = await prisma.volunteerTeam.findMany({
        where: {
          editionId: application.edition.id,
        },
      })

      const existingTeamNames = volunteerTeams.map((team) => team.name.toLowerCase().trim())

      for (const teamName of teamNames) {
        if (!teamName || teamName.trim() === '') continue

        const normalizedTeamName = teamName.toLowerCase().trim()
        if (!existingTeamNames.includes(normalizedTeamName)) {
          console.log(
            `  ⚠️  Candidature ${application.id}: équipe "${teamName}" introuvable dans VolunteerTeam pour l'édition "${application.edition.name}"`
          )
          inconsistenciesFound++
        }
      }
    }

    if (inconsistenciesFound === 0) {
      console.log('\n  ✅ Aucune incohérence détectée')
    } else {
      console.log(`\n  ⚠️  ${inconsistenciesFound} incohérences détectées`)
      console.log('     Ces équipes doivent être créées dans VolunteerTeam avant la migration')
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la vérification
checkTeamAssignments().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
