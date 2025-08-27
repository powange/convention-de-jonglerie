#!/usr/bin/env node
import { execSync } from 'child_process'

function hasDocker() {
  try {
    execSync('command -v docker', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function shouldSkipDocker() {
  if (process.env.TEST_DB_SKIP_DOCKER === 'true') return true
  if (!hasDocker()) return true
  // Heuristique: si on est dans un conteneur (présence de /.dockerenv) ET qu'on n'a pas explicitement demandé docker
  try {
    if (require('fs').existsSync('/.dockerenv') && !process.env.FORCE_INNER_DOCKER) return true
  } catch (e) {
    // ignore
  }
  return false
}

// Lancement des tests d'intégration avec DB
process.env.TEST_WITH_DB = 'true'

try {
  console.log("🧪 Lancement des tests d'intégration avec DB...")

  // S'assurer que la DB est démarrée et les migrations appliquées
  if (shouldSkipDocker()) {
    console.log('🐳 Docker non utilisé (déjà démarré ou indisponible). On passe directement aux migrations...')
  } else {
    console.log('🐳 Vérification / démarrage de la base de données de test via docker compose...')
    execSync('docker compose -f docker-compose.test.yml up -d --wait', { stdio: 'inherit' })
  }

  console.log('📋 Application des migrations...')
  execSync('node scripts/migrate-test.js', { stdio: 'inherit' })

  // Lancer les tests
  execSync('npx vitest run --config vitest.config.integration.ts', { stdio: 'inherit' })
  console.log("✅ Tests d'intégration terminés !")
} catch (error) {
  console.error("❌ Erreur lors des tests d'intégration:", error.message)
  if (!hasDocker()) {
    console.error('\nℹ️  Conseil: Docker n\'est pas disponible dans cet environnement. Si vous lancez déjà les services via un docker compose externe (ex: npm run docker:test), ce message peut indiquer que la base n\'est pas encore prête ou que les variables DATABASE_URL ne sont pas correctement définies.')
  }
  process.exit(1)
}
