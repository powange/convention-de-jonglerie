#!/usr/bin/env node
/**
 * Script de migration pour copier les équipes de bénévoles
 * depuis le champ JSON volunteersTeams vers la table VolunteerTeam
 *
 * Usage: npx tsx scripts/migrate-volunteer-teams.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Couleurs par défaut pour les équipes si elles n'en ont pas
const defaultColors = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#a855f7', // purple-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#64748b', // slate-500
]

interface TeamFromJSON {
  name: string
  slots?: number
  color?: string
  description?: string
}

async function migrateVolunteerTeams() {
  console.log('🚀 Début de la migration des équipes de bénévoles...\n')

  try {
    // Récupérer toutes les éditions qui ont des équipes dans le JSON
    const editions = await prisma.edition.findMany({
      where: {
        AND: [{ volunteersTeams: { not: null } }, { volunteersMode: 'INTERNAL' }],
      },
      include: {
        volunteerTeams: true, // Pour vérifier les équipes déjà migrées
      },
    })

    console.log(`📊 ${editions.length} éditions avec des équipes à migrer trouvées.\n`)

    let totalTeamsMigrated = 0
    let totalEditionsProcessed = 0

    for (const edition of editions) {
      console.log(`\n📝 Traitement de l'édition "${edition.name}" (ID: ${edition.id})...`)

      // Parse le JSON des équipes
      let teamsFromJSON: TeamFromJSON[] = []

      try {
        if (typeof edition.volunteersTeams === 'string') {
          teamsFromJSON = JSON.parse(edition.volunteersTeams)
        } else if (Array.isArray(edition.volunteersTeams)) {
          teamsFromJSON = edition.volunteersTeams as TeamFromJSON[]
        } else if (edition.volunteersTeams && typeof edition.volunteersTeams === 'object') {
          // Si c'est un objet, essayer de récupérer un tableau
          teamsFromJSON = Object.values(edition.volunteersTeams)
        }
      } catch (error) {
        console.error(`  ❌ Erreur lors du parsing du JSON pour l'édition ${edition.id}:`, error)
        continue
      }

      if (!Array.isArray(teamsFromJSON) || teamsFromJSON.length === 0) {
        console.log(`  ⏭️  Aucune équipe à migrer pour cette édition.`)
        continue
      }

      // Vérifier si des équipes ont déjà été migrées
      if (edition.volunteerTeams.length > 0) {
        console.log(
          `  ℹ️  Cette édition a déjà ${edition.volunteerTeams.length} équipes dans la nouvelle table.`
        )

        // Récupérer les noms des équipes existantes
        const existingTeamNames = edition.volunteerTeams.map((t) => t.name.toLowerCase())

        // Filtrer les équipes qui n'ont pas encore été migrées
        teamsFromJSON = teamsFromJSON.filter(
          (team) => team.name && !existingTeamNames.includes(team.name.toLowerCase().trim())
        )

        if (teamsFromJSON.length === 0) {
          console.log(`  ✅ Toutes les équipes ont déjà été migrées.`)
          continue
        }
        console.log(`  📋 ${teamsFromJSON.length} nouvelles équipes à migrer.`)
      }

      let teamsMigratedForEdition = 0
      let colorIndex = 0

      for (const teamJSON of teamsFromJSON) {
        // Vérifier que l'équipe a un nom valide
        if (!teamJSON.name || teamJSON.name.trim() === '') {
          continue
        }

        // Assigner une couleur si elle n'en a pas
        let teamColor = teamJSON.color || defaultColors[colorIndex % defaultColors.length]

        // Valider le format de la couleur
        if (!teamColor.match(/^#[0-9A-Fa-f]{6}$/)) {
          teamColor = defaultColors[colorIndex % defaultColors.length]
        }

        colorIndex++

        try {
          // Créer l'équipe dans la nouvelle table
          const newTeam = await prisma.volunteerTeam.create({
            data: {
              editionId: edition.id,
              name: teamJSON.name.trim(),
              description: teamJSON.description?.trim() || null,
              color: teamColor,
              maxVolunteers: teamJSON.slots || null,
            },
          })

          console.log(`  ✅ Équipe "${newTeam.name}" créée avec la couleur ${newTeam.color}`)
          teamsMigratedForEdition++
          totalTeamsMigrated++
        } catch (error) {
          console.error(`  ❌ Erreur lors de la création de l'équipe "${teamJSON.name}":`, error)
        }
      }

      if (teamsMigratedForEdition > 0) {
        console.log(`  ✨ ${teamsMigratedForEdition} équipes migrées pour cette édition.`)
        totalEditionsProcessed++

        // Optionnel : On pourrait supprimer le champ JSON après migration
        // Mais on le garde pour l'instant comme backup
        /*
        await prisma.edition.update({
          where: { id: edition.id },
          data: { volunteersTeams: null }
        })
        console.log(`  🧹 Champ JSON nettoyé pour cette édition.`)
        */
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`\n✅ Migration terminée avec succès !`)
    console.log(`   - ${totalEditionsProcessed} éditions traitées`)
    console.log(`   - ${totalTeamsMigrated} équipes migrées au total\n`)

    // Afficher un résumé des équipes créées
    const allTeams = await prisma.volunteerTeam.groupBy({
      by: ['editionId'],
      _count: {
        id: true,
      },
    })

    console.log('📊 Résumé par édition:')
    for (const teamCount of allTeams) {
      const edition = await prisma.edition.findUnique({
        where: { id: teamCount.editionId },
        select: { name: true },
      })
      console.log(`   - ${edition?.name}: ${teamCount._count.id} équipes`)
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter la migration
migrateVolunteerTeams().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
