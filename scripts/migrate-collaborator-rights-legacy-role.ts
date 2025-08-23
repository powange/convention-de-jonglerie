import { PrismaClient } from '@prisma/client'
/*
  Migration production (legacy) lorsque la colonne `role` existe encore.
  Objectif:
    - Mapper les valeurs role ('ADMINISTRATOR','MODERATOR') vers les booléens de droits si non déjà positionnés
    - Créer une entrée d'historique CREATED si absente
    - Fournir un mode --dry pour prévisualiser
    - Fonctionne même si le schéma Prisma local ne contient plus le champ `role` (utilise du SQL brut)

  Étapes recommandées avant exécution en production:
    1. Sauvegarde: mysqldump --single-transaction --quick --routines <db> ConventionCollaborator CollaboratorPermissionHistory > backup_collaborators.sql
    2. Exécuter en dry-run: npx tsx scripts/migrate-collaborator-rights-legacy-role.ts --dry
    3. Vérifier le plan
    4. Exécuter avec --yes pour appliquer
    5. Vérifier les compteurs et quelques enregistrements manuellement
    6. Lancer ensuite la migration Prisma qui supprime la colonne `role`
*/

interface Args { dry: boolean; yes: boolean }
function parseArgs(): Args {
  const dry = process.argv.includes('--dry')
  const yes = process.argv.includes('--yes') || process.argv.includes('-y')
  return { dry, yes }
}

const prisma = new PrismaClient()

async function main() {
  const { dry, yes } = parseArgs()
  console.log(`🚀 Migration legacy role -> droits (dry=${dry})`)

  // Collecter stats de base (utilise SQL brut car colonne role peut ne plus être dans le client généré)
  const rows: Array<any> = await prisma.$queryRawUnsafe(
    'SELECT id, conventionId, addedById, role, canEditConvention, canDeleteConvention, canManageCollaborators, canAddEdition, canEditAllEditions, canDeleteAllEditions FROM ConventionCollaborator'
  )

  const plan = rows.map((r) => {
    const changes: Record<string, boolean> = {}
    if (r.role === 'ADMINISTRATOR') {
      if (!r.canEditConvention) changes.canEditConvention = true
      if (!r.canDeleteConvention) changes.canDeleteConvention = true
      if (!r.canManageCollaborators) changes.canManageCollaborators = true
      if (!r.canAddEdition) changes.canAddEdition = true
      if (!r.canEditAllEditions) changes.canEditAllEditions = true
      if (!r.canDeleteAllEditions) changes.canDeleteAllEditions = true
    } else if (r.role === 'MODERATOR') {
      if (!r.canAddEdition) changes.canAddEdition = true
      if (!r.canEditAllEditions) changes.canEditAllEditions = true
    }
    return { id: r.id, conventionId: r.conventionId, addedById: r.addedById, role: r.role, changes }
  })

  const toUpdate = plan.filter((p) => Object.keys(p.changes).length)
  console.log(`🔍 ${rows.length} collaborateurs, ${toUpdate.length} nécessitent une mise à jour.`)
  toUpdate.slice(0, 15).forEach((p) => {
    console.log(`  - #${p.id} (${p.role}) -> ${Object.keys(p.changes).join(', ')}`)
  })
  if (toUpdate.length > 15) console.log(`  ... (+${toUpdate.length - 15} autres)`)

  // Historique manquant
  const historyMissing: Array<{ id: number }> = await prisma.$queryRawUnsafe(
    `SELECT c.id FROM ConventionCollaborator c
     LEFT JOIN CollaboratorPermissionHistory h ON h.collaboratorId = c.id AND h.changeType = 'CREATED'
     WHERE h.id IS NULL`
  )
  console.log(`🗂 Historiques CREATED manquants: ${historyMissing.length}`)

  if (dry) {
    console.log('✅ Dry-run terminé (aucune modification).')
    return
  }
  if (!yes) {
    console.error('❌ Confirmation requise (--yes).')
    process.exit(1)
  }

  // Exécuter dans une transaction
  await prisma.$transaction(async (tx) => {
    for (const u of toUpdate) {
      const sets = Object.entries(u.changes)
        .map(([k]) => `${k}=1`)
        .join(', ')
      if (sets) {
        await tx.$executeRawUnsafe(
          `UPDATE ConventionCollaborator SET ${sets} WHERE id=${u.id}`
        )
      }
    }

    for (const h of historyMissing) {
      // Recharger la ligne après update éventuel
      const c: any = await tx.$queryRawUnsafe(
        `SELECT id, conventionId, addedById, canEditConvention, canDeleteConvention, canManageCollaborators, canAddEdition, canEditAllEditions, canDeleteAllEditions FROM ConventionCollaborator WHERE id=${h.id} LIMIT 1`
      )
      const col = Array.isArray(c) ? c[0] : c
      await tx.$executeRawUnsafe(
        `INSERT INTO CollaboratorPermissionHistory (conventionId, collaboratorId, actorId, changeType, before, after, createdAt)
         VALUES (${col.conventionId}, ${col.id}, ${col.addedById}, 'CREATED', NULL, JSON_OBJECT('rights', JSON_OBJECT(
           'canEditConvention', ${col.canEditConvention ? 1 : 0},
           'canDeleteConvention', ${col.canDeleteConvention ? 1 : 0},
           'canManageCollaborators', ${col.canManageCollaborators ? 1 : 0},
           'canAddEdition', ${col.canAddEdition ? 1 : 0},
           'canEditAllEditions', ${col.canEditAllEditions ? 1 : 0},
           'canDeleteAllEditions', ${col.canDeleteAllEditions ? 1 : 0}
         ), 'perEdition', JSON_ARRAY()), NOW())`
      )
    }
  })

  console.log('✏️ Mises à jour appliquées:', toUpdate.length)
  console.log('🗂 Historiques créés:', historyMissing.length)
  console.log('✅ Migration legacy terminée. Vous pouvez ensuite supprimer la colonne `role`.')
}

main()
  .catch((e) => {
    console.error('Erreur migration legacy', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
