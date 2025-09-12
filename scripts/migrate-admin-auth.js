#!/usr/bin/env node

/**
 * Script pour migrer les APIs admin vers le nouveau système d'authentification mutualisé
 */

const fs = require('fs')
const path = require('path')

// Files to migrate (priorité aux plus importantes)
const filesToMigrate = [
  'server/api/admin/users/[id].get.ts',
  'server/api/admin/users/[id].put.ts',
  'server/api/admin/stats.get.ts',
  'server/api/admin/activity.get.ts',
  'server/api/admin/error-logs.get.ts',
  'server/api/admin/conventions.get.ts',
]

// Patterns à remplacer
const patterns = [
  // Pattern 1: requireUserSession avec vérification DB
  {
    from: /const { user } = await requireUserSession\(event\)\s*\n\s*if \(!user\?\.id\) \{[^}]+\}\s*\n\s*const currentUser = await prisma\.user\.findUnique\(\{[^}]+select: \{ isGlobalAdmin: true[^}]*\}[^}]*\}\)\s*\n\s*if \(!currentUser\?\.isGlobalAdmin\) \{[^}]+\}/gs,
    to: 'await requireGlobalAdmin(event)',
  },

  // Pattern 2: event.context.user simple
  {
    from: /const user = event\.context\.user\s*\n\s*if \(!user \|\| !user\.isGlobalAdmin\) \{[^}]+\}/gs,
    to: 'await requireGlobalAdmin(event)',
  },

  // Pattern 3: Imports à ajouter/remplacer
  {
    from: /import { PrismaClient } from '@prisma\/client'\s*\n\s*const prisma = new PrismaClient\(\)/g,
    to: "import { prisma } from '../../../utils/prisma'",
  },
]

async function migrateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`)
    return false
  }

  let content = fs.readFileSync(fullPath, 'utf-8')
  let modified = false

  // Ajouter l'import requireGlobalAdmin si pas présent
  if (!content.includes('requireGlobalAdmin')) {
    // Trouver la ligne après les imports existants
    const importMatch = content.match(/^import.*$/gm)
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1]
      const insertIndex = content.indexOf(lastImport) + lastImport.length
      content =
        content.slice(0, insertIndex) +
        "\nimport { requireGlobalAdmin } from '../../../utils/admin-auth'" +
        content.slice(insertIndex)
      modified = true
    }
  }

  // Appliquer les patterns de remplacement
  patterns.forEach((pattern) => {
    if (pattern.from.test(content)) {
      content = content.replace(pattern.from, pattern.to)
      modified = true
    }
  })

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✅ Migrated: ${filePath}`)
    return true
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`)
    return false
  }
}

async function main() {
  console.log('🔄 Starting admin auth migration...\n')

  let migratedCount = 0

  for (const file of filesToMigrate) {
    const success = await migrateFile(file)
    if (success) migratedCount++
  }

  console.log(`\n✨ Migration completed! ${migratedCount}/${filesToMigrate.length} files migrated.`)
  console.log('\n📝 Manual review recommended for:')
  console.log('- Variable names (currentUser -> adminUser)')
  console.log('- Import order and cleanup')
  console.log('- TypeScript errors')
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { migrateFile, patterns }
