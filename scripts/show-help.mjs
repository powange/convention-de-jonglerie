#!/usr/bin/env node

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Couleurs pour le terminal
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
}

console.log(`${colors.bold}${colors.blue}📦 Scripts disponibles${colors.reset}\n`)

const sections = [
  {
    title: '🚀 Développement',
    color: colors.green,
    scripts: [
      { name: 'dev', desc: 'Lance le serveur de développement sur http://localhost:3000' },
      { name: 'build', desc: 'Compile l\'application optimisée pour la production' },
      { name: 'preview', desc: 'Teste la version build localement' },
      { name: 'generate', desc: 'Génère un site statique (SSG)' }
    ]
  },
  {
    title: '🧹 Qualité du code',
    color: colors.yellow,
    scripts: [
      { name: 'lint', desc: 'Vérifie les erreurs et le style du code' },
      { name: 'lint:fix', desc: 'Corrige automatiquement les problèmes détectés' }
    ]
  },
  {
    title: '🛠️ Scripts métier',
    color: colors.magenta,
    scripts: [
      { name: 'geocode', desc: 'Ajoute les coordonnées GPS aux conventions' },
      { name: 'db:clean-tokens', desc: 'Supprime les tokens expirés de la base' }
    ]
  },
  {
    title: '👤 Gestion des super administrateurs',
    color: colors.yellow,
    scripts: [
      { name: 'admin:list', desc: 'Liste tous les super administrateurs' },
      { name: 'admin:add <email>', desc: 'Promouvoir un utilisateur en super admin' },
      { name: 'admin:remove <email>', desc: 'Rétrograder un super admin' }
    ]
  },
  {
    title: '🧪 Tests unitaires (rapides, sans DB)',
    color: colors.cyan,
    scripts: [
      { name: 'test', desc: 'Mode watch, relance automatiquement' },
      { name: 'test:ui', desc: 'Interface graphique dans le navigateur' },
      { name: 'test:run', desc: 'Une seule exécution (CI/CD)' }
    ]
  },
  {
    title: '🗄️ Tests d\'intégration (avec vraie DB)',
    color: colors.blue,
    scripts: [
      { name: 'test:db', desc: 'Tests avec DB en mode watch' },
      { name: 'test:db:run', desc: 'Tests avec DB une fois' },
      { name: 'test:setup', desc: 'Démarre MySQL + migrations' },
      { name: 'test:teardown', desc: 'Arrête et nettoie tout' }
    ]
  }
]

sections.forEach(section => {
  console.log(`${colors.bold}${section.color}${section.title}${colors.reset}`)
  section.scripts.forEach(script => {
    console.log(`  ${colors.green}npm run ${script.name}${colors.reset}${colors.dim} - ${script.desc}${colors.reset}`)
  })
  console.log()
})

console.log(`${colors.dim}⚙️ Script automatique:${colors.reset}`)
console.log(`  ${colors.dim}postinstall - S'exécute automatiquement après npm install${colors.reset}\n`)

// Afficher aussi les scripts personnalisés si on passe un argument
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`${colors.bold}${colors.yellow}💡 Usage:${colors.reset}`)
  console.log(`  ${colors.green}npm run help${colors.reset} - Affiche cette aide`)
  console.log(`  ${colors.green}npm run help -- --help${colors.reset} - Affiche l'aide détaillée`)
  console.log()
}