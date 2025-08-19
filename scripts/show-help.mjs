#!/usr/bin/env node

// Note: Ce script n'a pas besoin de __filename/__dirname

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
      { name: 'generate', desc: 'Génère un site statique (SSG)' },
      { name: 'kill-servers', desc: 'Arrête tous les serveurs de développement du projet' }
    ]
  },
  {
    title: '🧹 Qualité du code',
    color: colors.yellow,
    scripts: [
      { name: 'lint', desc: 'Vérifie les erreurs et le style du code' },
      { name: 'lint:fix', desc: 'Corrige automatiquement les problèmes détectés' },
      { name: 'check-i18n', desc: 'Vérifie les traductions (clés manquantes, inutilisées, doublons)' },
      { name: 'check-i18n -- -s 1', desc: 'Vérifie uniquement les clés manquantes' },
      { name: 'check-i18n -- -s 2', desc: 'Vérifie uniquement les clés inutilisées' },
      { name: 'check-i18n -- -s 3', desc: 'Vérifie uniquement les valeurs dupliquées' },
      { name: 'check-i18n -- -s 4', desc: 'Vérifie uniquement les textes hardcodés' },
      { name: 'check-i18n -- -h', desc: 'Affiche l\'aide détaillée du script' },
      { name: 'check-translations', desc: 'Compare les traductions entre les langues' },
      { name: 'check-translations -- -l es', desc: 'Vérifie uniquement les traductions espagnoles' },
  { name: 'check-translations -- -s', desc: 'Affiche uniquement le résumé des traductions' },
  { name: 'normalize-locales', desc: 'Normalise la structure et l\'ordre des fichiers de locales' },
  { name: 'prune-i18n', desc: 'Supprime les clés i18n inutilisées (selon le dernier check-i18n)' }
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
  { name: 'test:unit', desc: 'Alias de test (watch)' },
      { name: 'test:ui', desc: 'Interface graphique dans le navigateur' },
  { name: 'test:run', desc: 'Une seule exécution (CI/CD)' },
  { name: 'test:unit:run', desc: 'Alias de test:run (CI/CD)' }
    ]
  },
  {
    title: '🧩 Tests Nuxt & E2E',
    color: colors.cyan,
    scripts: [
      { name: 'test:nuxt', desc: 'Tests avec runtime Nuxt (watch)' },
      { name: 'test:nuxt:run', desc: 'Tests Nuxt (one-shot)' },
      { name: 'test:e2e', desc: 'Tests end-to-end (watch)' },
      { name: 'test:e2e:run', desc: 'Tests end-to-end (one-shot)' },
      { name: 'test:all', desc: 'Raccourci: unit + nuxt + e2e (one-shot)' }
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
  },
  {
    title: '🐳 Docker & Compose',
    color: colors.blue,
    scripts: [
      { name: 'docker:dev', desc: 'Démarre l\'env de développement (iso release)' },
      { name: 'docker:dev:detached', desc: 'Démarre en arrière-plan' },
      { name: 'docker:dev:down', desc: 'Arrête les services de dev' },
      { name: 'docker:dev:logs', desc: 'Affiche les logs de l\'app (suivi)' },
      { name: 'docker:dev:exec', desc: 'Ouvre un shell dans l\'app' },
      { name: 'docker:release:up', desc: 'Démarre l\'environnement de production local' },
      { name: 'docker:release:down', desc: 'Arrête l\'environnement de production local' },
      { name: 'docker:test', desc: 'Lance tous les tests dans Docker (avec DB)' },
      { name: 'docker:test:rebuild', desc: 'Reconstruit les images de test (no-cache)' },
      { name: 'docker:test:clean', desc: 'Nettoie les conteneurs/volumes de test' },
      { name: 'docker:test:unit', desc: 'Lance uniquement les tests unitaires dans Docker' },
      { name: 'docker:test:unit:clean', desc: 'Nettoie l\'env de tests unitaires' },
      { name: 'docker:test:integration', desc: 'Lance uniquement les tests d\'intégration DB dans Docker' },
      { name: 'docker:test:integration:clean', desc: 'Nettoie l\'env de tests d\'intégration' },
      { name: 'docker:test:ui', desc: 'Ouvre l\'UI Vitest dans Docker' },
      { name: 'docker:test:ui:clean', desc: 'Nettoie l\'env de tests UI' }
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