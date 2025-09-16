#!/usr/bin/env node
/**
 * Script pour vérifier les équipes de bénévoles existantes
 * dans le JSON et dans la nouvelle table
 *
 * Usage: npx tsx scripts/check-volunteer-teams.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkVolunteerTeams() {
  console.log('🔍 Vérification des équipes de bénévoles...\n')

  try {
    // 1. Vérifier les éditions avec des équipes dans le JSON
    const editionsWithJSON = await prisma.edition.findMany({
      where: {
        volunteersTeams: { not: null },
      },
      select: {
        id: true,
        name: true,
        volunteersMode: true,
        volunteersTeams: true,
      },
    })

    console.log('📋 Éditions avec des équipes dans le JSON:')
    console.log('='.repeat(60))

    for (const edition of editionsWithJSON) {
      console.log(`\nÉdition: "${edition.name}" (ID: ${edition.id})`)
      console.log(`Mode: ${edition.volunteersMode}`)

      let teams = []
      try {
        if (typeof edition.volunteersTeams === 'string') {
          teams = JSON.parse(edition.volunteersTeams)
        } else if (Array.isArray(edition.volunteersTeams)) {
          teams = edition.volunteersTeams
        } else if (edition.volunteersTeams && typeof edition.volunteersTeams === 'object') {
          teams = Object.values(edition.volunteersTeams)
        }
      } catch (error) {
        console.log('  ❌ Erreur lors du parsing du JSON')
        continue
      }

      if (Array.isArray(teams) && teams.length > 0) {
        console.log(`  Équipes (${teams.length}):`)
        teams.forEach((team: any, index: number) => {
          console.log(
            `    ${index + 1}. ${team.name || 'Sans nom'}${team.slots ? ` (${team.slots} places)` : ''}`
          )
        })
      } else {
        console.log('  Aucune équipe trouvée dans le JSON')
      }
    }

    // 2. Vérifier les équipes dans la nouvelle table
    console.log('\n\n📊 Équipes dans la nouvelle table VolunteerTeam:')
    console.log('='.repeat(60))

    const volunteerTeams = await prisma.volunteerTeam.findMany({
      include: {
        edition: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
      orderBy: [{ editionId: 'asc' }, { name: 'asc' }],
    })

    if (volunteerTeams.length === 0) {
      console.log('\nAucune équipe dans la nouvelle table.')
    } else {
      let currentEditionId: number | null = null

      for (const team of volunteerTeams) {
        if (team.editionId !== currentEditionId) {
          currentEditionId = team.editionId
          console.log(`\nÉdition: "${team.edition.name}" (ID: ${team.editionId})`)
        }
        console.log(`  - ${team.name}`)
        console.log(`    Couleur: ${team.color}`)
        if (team.maxVolunteers) console.log(`    Max bénévoles: ${team.maxVolunteers}`)
        if (team.description) console.log(`    Description: ${team.description}`)
        if (team._count.timeSlots > 0) console.log(`    Créneaux: ${team._count.timeSlots}`)
      }
    }

    // 3. Statistiques
    console.log('\n\n📈 Statistiques:')
    console.log('='.repeat(60))

    const totalEditionsWithJSON = editionsWithJSON.filter((e) => {
      try {
        const teams =
          typeof e.volunteersTeams === 'string' ? JSON.parse(e.volunteersTeams) : e.volunteersTeams
        return Array.isArray(teams) && teams.length > 0
      } catch {
        return false
      }
    }).length

    const totalTeamsInNewTable = volunteerTeams.length
    const editionsWithNewTeams = new Set(volunteerTeams.map((t) => t.editionId)).size

    console.log(`\n  📋 Éditions avec équipes dans JSON: ${totalEditionsWithJSON}`)
    console.log(`  📊 Éditions avec équipes dans la nouvelle table: ${editionsWithNewTeams}`)
    console.log(`  🔢 Total d'équipes dans la nouvelle table: ${totalTeamsInNewTable}`)

    if (totalEditionsWithJSON > editionsWithNewTeams) {
      console.log(
        `\n  ⚠️  ${totalEditionsWithJSON - editionsWithNewTeams} éditions ont des équipes à migrer`
      )
      console.log(`     Exécutez 'npx tsx scripts/migrate-volunteer-teams.ts' pour migrer`)
    } else {
      console.log(`\n  ✅ Toutes les éditions semblent avoir été migrées`)
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la vérification
checkVolunteerTeams().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
