/**
 * Script pour créer les conversations pour toutes les assignations d'équipes existantes
 * Ce script doit être exécuté une seule fois après la migration de la base de données
 *
 * Usage: npx tsx scripts/messenger/create-conversations-for-existing-teams.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createConversationsForExistingTeams() {
  console.log('🚀 Démarrage de la création des conversations pour les équipes existantes...\n')

  try {
    // Récupérer toutes les assignations d'équipes
    const teamAssignments = await prisma.applicationTeamAssignment.findMany({
      include: {
        application: {
          select: {
            id: true,
            userId: true,
            editionId: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            editionId: true,
          },
        },
      },
    })

    console.log(`📊 Trouvé ${teamAssignments.length} assignations d'équipes\n`)

    // Grouper par équipe
    const teamGroups = new Map<string, typeof teamAssignments>()
    for (const assignment of teamAssignments) {
      const key = `${assignment.team.editionId}-${assignment.teamId}`
      if (!teamGroups.has(key)) {
        teamGroups.set(key, [])
      }
      teamGroups.get(key)!.push(assignment)
    }

    console.log(`🎯 ${teamGroups.size} équipes uniques à traiter\n`)

    let conversationsCreated = 0
    let participantsAdded = 0
    let errors = 0

    // Traiter chaque équipe
    for (const [key, assignments] of teamGroups.entries()) {
      const [editionId, teamId] = key.split('-')
      const teamName = assignments[0].team.name

      console.log(`\n📦 Traitement de l'équipe "${teamName}" (${assignments.length} membres)`)

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Créer ou récupérer la conversation de groupe
          let groupConversation = await tx.conversation.findFirst({
            where: {
              editionId: parseInt(editionId),
              teamId,
              type: 'TEAM_GROUP',
            },
          })

          if (!groupConversation) {
            groupConversation = await tx.conversation.create({
              data: {
                editionId: parseInt(editionId),
                teamId,
                type: 'TEAM_GROUP',
              },
            })
            conversationsCreated++
            console.log(`  ✅ Conversation de groupe créée`)
          } else {
            console.log(`  ℹ️  Conversation de groupe existante`)
          }

          // 2. Ajouter tous les membres comme participants
          for (const assignment of assignments) {
            const existingParticipant = await tx.conversationParticipant.findFirst({
              where: {
                conversationId: groupConversation.id,
                userId: assignment.application.userId,
              },
            })

            if (!existingParticipant) {
              await tx.conversationParticipant.create({
                data: {
                  conversationId: groupConversation.id,
                  userId: assignment.application.userId,
                },
              })
              participantsAdded++
            } else if (existingParticipant.leftAt) {
              // Réactiver le participant s'il avait quitté
              await tx.conversationParticipant.update({
                where: { id: existingParticipant.id },
                data: { leftAt: null },
              })
              participantsAdded++
            }
          }

          console.log(`  👥 ${assignments.length} participants ajoutés/vérifiés`)

          // 3. Trouver le(s) responsable(s) de l'équipe
          const leaders = assignments.filter((a) => a.isLeader)
          const leaderUserIds = leaders.map((l) => l.application.userId)

          if (leaders.length > 0) {
            console.log(`  👑 ${leaders.length} responsable(s) trouvé(s)`)

            // Pour chaque membre qui n'est pas responsable
            const members = assignments.filter((a) => !a.isLeader)

            for (const member of members) {
              const memberUserId = member.application.userId

              // Tous les participants attendus : le membre + tous les responsables
              const expectedParticipantIds = [memberUserId, ...leaderUserIds].sort()

              // Chercher une conversation existante avec exactement ces participants
              const existingConversations = await tx.conversation.findMany({
                where: {
                  editionId: parseInt(editionId),
                  teamId,
                  type: 'TEAM_LEADER_PRIVATE',
                },
                include: {
                  participants: {
                    where: {
                      leftAt: null, // Uniquement les participants actifs
                    },
                    select: {
                      userId: true,
                    },
                  },
                },
              })

              // Trouver une conversation qui a exactement les bons participants
              let privateConversation = existingConversations.find((conv) => {
                const actualParticipantIds = conv.participants.map((p) => p.userId).sort()
                return (
                  actualParticipantIds.length === expectedParticipantIds.length &&
                  actualParticipantIds.every((id, index) => id === expectedParticipantIds[index])
                )
              })

              if (!privateConversation) {
                // Créer une nouvelle conversation avec tous les participants
                privateConversation = await tx.conversation.create({
                  data: {
                    editionId: parseInt(editionId),
                    teamId,
                    type: 'TEAM_LEADER_PRIVATE',
                    participants: {
                      create: expectedParticipantIds.map((participantUserId) => ({
                        userId: participantUserId,
                      })),
                    },
                  },
                })
                conversationsCreated++
                participantsAdded += expectedParticipantIds.length
              } else {
                // Vérifier et réactiver les participants si nécessaire
                const allParticipants = await tx.conversationParticipant.findMany({
                  where: {
                    conversationId: privateConversation.id,
                  },
                })

                for (const participant of allParticipants) {
                  if (participant.leftAt && expectedParticipantIds.includes(participant.userId)) {
                    await tx.conversationParticipant.update({
                      where: { id: participant.id },
                      data: { leftAt: null },
                    })
                  }
                }
              }
            }

            console.log(
              `  💬 Conversations privées créées (${members.length} membres × ${leaders.length} responsable${leaders.length > 1 ? 's' : ''})`
            )
          } else {
            console.log(`  ℹ️  Pas de responsable pour cette équipe`)
          }
        })

        console.log(`  ✅ Équipe "${teamName}" traitée avec succès`)
      } catch (error) {
        console.error(`  ❌ Erreur lors du traitement de l'équipe "${teamName}":`, error)
        errors++
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n📊 RÉSUMÉ')
    console.log('─'.repeat(80))
    console.log(`✅ Conversations créées: ${conversationsCreated}`)
    console.log(`👥 Participants ajoutés: ${participantsAdded}`)
    console.log(`❌ Erreurs: ${errors}`)
    console.log('\n✨ Migration terminée avec succès!\n')
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script
createConversationsForExistingTeams()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
