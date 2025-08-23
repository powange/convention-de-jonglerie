import { PrismaClient, CollaboratorPermissionChangeType } from '@prisma/client'

/*
  Script de migration douce des anciens rôles vers le nouveau système de droits granulaires.
  - Mappe ADMINISTRATOR => tous les booléens pertinents à true
  - Mappe MODERATOR => droits limités (peut ajouter/éditer éditions ?) ajuster selon politique
  - Ne réécrase PAS les droits déjà personnalisés (si un booléen est déjà true, on le garde)
  - Crée une entrée d'historique CREATED si aucune existante pour le collaborateur
  - Option --dry pour simulation
*/

const prisma = new PrismaClient()

interface Args {
  dry: boolean
  yes: boolean
}

function parseArgs(): Args {
  const dry = process.argv.includes('--dry')
  const yes = process.argv.includes('--yes') || process.argv.includes('-y')
  return { dry, yes }
}

async function main() {
  const { dry, yes } = parseArgs()
  console.log(`🚀 Migration droits collaborateurs (dry=${dry})`)

  const collaborators = await prisma.conventionCollaborator.findMany({
    include: { permissionHistory: { select: { id: true }, take: 1, orderBy: { id: 'asc' } } },
  })
  console.log(`🔍 ${collaborators.length} collaborateurs trouvés`)

  // Première passe: plan
  type PlanItem = {
    id: number
    conventionId: number
    addedById: number
    changes: Record<string, boolean>
    needsHistory: boolean
    current: (typeof collaborators)[number]
  }
  const plan: PlanItem[] = []
  for (const c of collaborators) {
    const changes: Record<string, boolean> = {}
    // Legacy: c.role supprimé du schéma. On déduit un ancien "profil" via ses droits existants
    const isLegacyAdmin =
      c.canManageCollaborators ||
      c.canDeleteConvention ||
      c.canEditConvention ||
      (c.canAddEdition && c.canEditAllEditions && c.canDeleteAllEditions)
    const isLegacyModerator = !isLegacyAdmin && (c.canAddEdition || c.canEditAllEditions)
    if (isLegacyAdmin) {
      if (!c.canEditConvention) changes.canEditConvention = true
      if (!c.canDeleteConvention) changes.canDeleteConvention = true
      if (!c.canManageCollaborators) changes.canManageCollaborators = true
      if (!c.canAddEdition) changes.canAddEdition = true
      if (!c.canEditAllEditions) changes.canEditAllEditions = true
      if (!c.canDeleteAllEditions) changes.canDeleteAllEditions = true
    } else if (isLegacyModerator) {
      if (!c.canAddEdition) changes.canAddEdition = true
      if (!c.canEditAllEditions) changes.canEditAllEditions = true
    }
    const needsHistory = c.permissionHistory.length === 0
    plan.push({
      id: c.id,
      conventionId: c.conventionId,
      addedById: c.addedById,
      changes,
      needsHistory,
      current: c,
    })
  }

  const willUpdate = plan.filter((p) => Object.keys(p.changes).length).length
  const willHistory = plan.filter((p) => p.needsHistory).length

  console.log('--- Plan ---')
  console.log(`  ✏️  Collaborateurs à mettre à jour: ${willUpdate}`)
  console.log(`  🗂  Historiques baseline à créer: ${willHistory}`)
  if (willUpdate) {
    console.log('  Détails (max 10):')
    plan
      .filter((p) => Object.keys(p.changes).length)
      .slice(0, 10)
      .forEach((p) => {
  console.log(`   - #${p.id} -> ${Object.keys(p.changes).join(', ')}`)
      })
    if (willUpdate > 10) console.log(`   ... (+${willUpdate - 10} autres)`)
  }

  if (!dry && !yes) {
    if (!process.stdout.isTTY) {
      console.error('❌ Terminal non interactif. Utilisez --yes pour confirmer.')
      process.exit(1)
    }
    const confirmed = await askConfirmation("Confirmer l'application du plan ? (y/N) ")
    if (!confirmed) {
      console.log('Opération annulée.')
      return
    }
  }

  let updated = 0,
    historyCreated = 0
  for (const item of plan) {
    const { id, changes, needsHistory, current } = item
    // Appliquer modifications
    if (Object.keys(changes).length) {
      if (!dry) {
        await prisma.conventionCollaborator.update({ where: { id }, data: changes })
      }
      updated++
      console.log(
        `✅ Collaborateur ${id} droits appliqués: ${Object.keys(changes).join(', ')}`
      )
    }
    if (needsHistory) {
      if (!dry) {
        await prisma.collaboratorPermissionHistory.create({
          data: {
            conventionId: item.conventionId,
            collaboratorId: id,
            actorId: item.addedById,
            changeType: CollaboratorPermissionChangeType.CREATED,
            before: undefined,
            after: {
              rights: {
                canEditConvention: current.canEditConvention || !!changes.canEditConvention,
                canDeleteConvention: current.canDeleteConvention || !!changes.canDeleteConvention,
                canManageCollaborators:
                  current.canManageCollaborators || !!changes.canManageCollaborators,
                canAddEdition: current.canAddEdition || !!changes.canAddEdition,
                canEditAllEditions: current.canEditAllEditions || !!changes.canEditAllEditions,
                canDeleteAllEditions:
                  current.canDeleteAllEditions || !!changes.canDeleteAllEditions,
              },
              perEdition: [],
            },
          },
        })
      }
      historyCreated++
    }
  }

  console.log('\nRésumé:')
  console.log(`  ✏️  Collaborateurs ajustés: ${updated}`)
  console.log(`  🗂  Entrées history créées: ${historyCreated}`)
  console.log('Terminé.')
}

async function askConfirmation(question: string): Promise<boolean> {
  const { createInterface } = await import('readline')
  return await new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer: string) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      resolve(['y', 'yes', 'o', 'oui'].includes(normalized))
    })
  })
}

main()
  .catch((e) => {
    console.error('❌ Erreur migration', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
