#!/usr/bin/env node

/**
 * Script de consolidation des migrations Prisma
 * Crée une migration initiale propre basée sur le schéma actuel
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
}

console.log(`${colors.blue}${colors.bold}=== CONSOLIDATION DES MIGRATIONS PRISMA ===${colors.reset}\n`)

const MIGRATIONS_DIR = 'prisma/migrations'
const SCHEMA_FILE = 'prisma/schema.prisma'

// Vérifications préliminaires
if (!fs.existsSync(SCHEMA_FILE)) {
  console.error(`${colors.red}❌ Fichier schema.prisma non trouvé${colors.reset}`)
  process.exit(1)
}

// Compter les migrations actuelles
const migrationCount = fs.existsSync(MIGRATIONS_DIR) 
  ? fs.readdirSync(MIGRATIONS_DIR).filter(dir => 
      fs.statSync(path.join(MIGRATIONS_DIR, dir)).isDirectory()
    ).length 
  : 0

console.log(`${colors.yellow}📊 Migrations actuelles: ${migrationCount}${colors.reset}`)

if (migrationCount === 0) {
  console.log(`${colors.green}✅ Aucune migration à consolider${colors.reset}`)
  process.exit(0)
}

// Demander confirmation
console.log(`${colors.yellow}⚠️  Cette opération va:${colors.reset}`)
console.log(`   - Sauvegarder les migrations actuelles`)
console.log(`   - Créer une migration initiale propre`)
console.log(`   - Réduire ${migrationCount} migrations à 1 seule`)

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

readline.question(`\n${colors.bold}Continuer? (y/N): ${colors.reset}`, (answer) => {
  readline.close()
  
  if (answer.toLowerCase() !== 'y') {
    console.log(`${colors.yellow}Opération annulée${colors.reset}`)
    process.exit(0)
  }
  
  try {
    consolidateMigrations()
  } catch (error) {
    console.error(`${colors.red}❌ Erreur: ${error.message}${colors.reset}`)
    process.exit(1)
  }
})

function consolidateMigrations() {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]
  const backupDir = `prisma/migrations-backup-${timestamp}`
  
  console.log(`\n${colors.blue}🔄 Début de la consolidation...${colors.reset}`)
  
  // 1. Sauvegarder les migrations actuelles
  console.log(`${colors.yellow}📦 Sauvegarde des migrations...${colors.reset}`)
  execSync(`cp -r ${MIGRATIONS_DIR} ${backupDir}`)
  console.log(`${colors.green}✓ Sauvegarde créée: ${backupDir}${colors.reset}`)
  
  // 2. Supprimer les migrations actuelles
  console.log(`${colors.yellow}🗑️  Suppression des anciennes migrations...${colors.reset}`)
  execSync(`rm -rf ${MIGRATIONS_DIR}`)
  
  // 3. Créer une nouvelle migration initiale
  console.log(`${colors.yellow}🆕 Création de la migration consolidée...${colors.reset}`)
  
  // Vérifier si la DB existe et est à jour
  try {
    execSync('npx prisma migrate status', { stdio: 'pipe' })
    console.log(`${colors.blue}ℹ️  Base de données détectée et à jour${colors.reset}`)
    
    // Créer migration avec --create-only puis marquer comme appliquée
    execSync('npx prisma migrate dev --create-only --name consolidated_schema', { 
      stdio: 'inherit' 
    })
    
    // Marquer comme appliquée (pour bases existantes)
    const migrationName = fs.readdirSync(MIGRATIONS_DIR).find(dir => 
      dir.includes('consolidated_schema')
    )
    
    if (migrationName) {
      console.log(`${colors.yellow}🏷️  Marquage de la migration comme appliquée...${colors.reset}`)
      execSync(`npx prisma migrate resolve --applied ${migrationName}`, { 
        stdio: 'inherit' 
      })
    }
    
  } catch (error) {
    // Base vide ou problème, migration normale
    console.log(`${colors.yellow}🆕 Nouvelle base détectée, migration complète...${colors.reset}`)
    execSync('npx prisma migrate dev --name consolidated_schema', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    })
  }
  
  // 4. Vérifier le résultat
  const newMigrationCount = fs.readdirSync(MIGRATIONS_DIR).filter(dir => 
    fs.statSync(path.join(MIGRATIONS_DIR, dir)).isDirectory()
  ).length
  
  console.log(`\n${colors.green}${colors.bold}✅ CONSOLIDATION TERMINÉE${colors.reset}`)
  console.log(`${colors.green}📈 Réduction: ${migrationCount} → ${newMigrationCount} migration(s)${colors.reset}`)
  console.log(`${colors.blue}💾 Sauvegarde disponible: ${backupDir}${colors.reset}`)
  console.log(`\n${colors.yellow}💡 Prochaines étapes:${colors.reset}`)
  console.log(`   1. Tester l'application`)
  console.log(`   2. Lancer les tests: npm run test:db`)
  console.log(`   3. Si tout fonctionne: rm -rf ${backupDir}`)
}