#!/usr/bin/env node

/**
 * ⚠️ SCRIPT NUCLÉAIRE : Reset complet des migrations
 * Supprime TOUT l'historique de migration
 * À utiliser UNIQUEMENT si tous les environnements sont synchronisés
 */

const fs = require('fs')
const { execSync } = require('child_process')
const readline = require('readline')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
}

console.log(`${colors.red}${colors.bold}⚠️  RESET NUCLÉAIRE DES MIGRATIONS ⚠️${colors.reset}\n`)

const MIGRATIONS_DIR = 'prisma/migrations'

// Avertissements
console.log(`${colors.red}${colors.bold}DANGER : Cette opération va :${colors.reset}`)
console.log(`${colors.red}  ❌ Supprimer TOUT l'historique des migrations${colors.reset}`)
console.log(`${colors.red}  ❌ Vider la table _prisma_migrations${colors.reset}`)
console.log(`${colors.red}  ❌ Rendre impossible le rollback${colors.reset}`)
console.log(`${colors.red}  ❌ Potentiellement casser la sync entre environnements${colors.reset}`)

console.log(`\n${colors.yellow}${colors.bold}Pré-requis OBLIGATOIRES :${colors.reset}`)
console.log(`${colors.yellow}  ✅ TOUS les environnements ont la même structure DB${colors.reset}`)
console.log(`${colors.yellow}  ✅ Sauvegarde des données critiques effectuée${colors.reset}`)
console.log(`${colors.yellow}  ✅ Accord de l'équipe pour perdre l'historique${colors.reset}`)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log(`\n${colors.red}${colors.bold}Tapez exactement "JE SUIS SUR" pour continuer :${colors.reset}`)

rl.question('> ', (answer) => {
  rl.close()
  
  if (answer !== 'JE SUIS SUR') {
    console.log(`${colors.green}✅ Opération annulée (sage décision)${colors.reset}`)
    process.exit(0)
  }
  
  nuclearReset()
})

function nuclearReset() {
  console.log(`\n${colors.red}💥 Début du reset nucléaire...${colors.reset}`)
  
  try {
    // 1. Sauvegarder d'abord
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]
    const backupDir = `prisma/migrations-nuclear-backup-${timestamp}`
    
    if (fs.existsSync(MIGRATIONS_DIR)) {
      console.log(`${colors.yellow}📦 Sauvegarde d'urgence...${colors.reset}`)
      execSync(`cp -r ${MIGRATIONS_DIR} ${backupDir}`)
      console.log(`${colors.blue}💾 Sauvegarde : ${backupDir}${colors.reset}`)
    }
    
    // 2. Supprimer les migrations
    console.log(`${colors.red}🗑️  Suppression des migrations...${colors.reset}`)
    if (fs.existsSync(MIGRATIONS_DIR)) {
      execSync(`rm -rf ${MIGRATIONS_DIR}`)
    }
    
    // 3. Vider la table _prisma_migrations
    console.log(`${colors.red}💣 Vidage de la table _prisma_migrations...${colors.reset}`)
    execSync('npx prisma db execute --stdin', {
      input: 'DELETE FROM _prisma_migrations;',
      stdio: ['pipe', 'inherit', 'inherit']
    })
    
    // 4. Créer une nouvelle migration initiale
    console.log(`${colors.green}🆕 Création d'une migration initiale propre...${colors.reset}`)
    execSync('npx prisma migrate dev --name initial_schema', { 
      stdio: 'inherit' 
    })
    
    // 5. Vérifier
    const newCount = fs.readdirSync(MIGRATIONS_DIR).filter(dir => 
      fs.statSync(`${MIGRATIONS_DIR}/${dir}`).isDirectory()
    ).length
    
    console.log(`\n${colors.green}${colors.bold}💥 RESET NUCLÉAIRE TERMINÉ${colors.reset}`)
    console.log(`${colors.green}📈 Migrations : ∞ → ${newCount}${colors.reset}`)
    console.log(`${colors.blue}💾 Sauvegarde : ${backupDir}${colors.reset}`)
    
    console.log(`\n${colors.yellow}🚨 ACTIONS REQUISES :${colors.reset}`)
    console.log(`${colors.yellow}  1. Appliquer sur TOUS les autres environnements :${colors.reset}`)
    console.log(`${colors.cyan}     git pull && npm run db:reset:nuclear${colors.reset}`)
    console.log(`${colors.yellow}  2. Informer l'équipe du changement${colors.reset}`)
    console.log(`${colors.yellow}  3. Tester TOUS les environnements${colors.reset}`)
    
  } catch (error) {
    console.error(`${colors.red}💥 ERREUR CRITIQUE : ${error.message}${colors.reset}`)
    console.log(`${colors.yellow}🆘 Récupération possible avec la sauvegarde${colors.reset}`)
    process.exit(1)
  }
}