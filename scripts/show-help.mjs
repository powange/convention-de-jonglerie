#!/usr/bin/env node

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

// Organisation : du quotidien vers le spécialisé
const sections = [
  { title: '🚀 Cycle de développement', color: colors.green, scripts: [
    { name: 'dev', desc: 'Serveur de dev http://localhost:3000' },
    { name: 'build', desc: 'Build production optimisée' },
    { name: 'preview', desc: 'Prévisualise le build local' },
    { name: 'generate', desc: 'Génère le site statique (SSG)' },
    { name: 'kill-servers', desc: 'Stoppe les serveurs de dev en cours' }
  ] },
  { title: '🗄️ Base de données', color: colors.magenta, scripts: [
    { name: 'db:seed:dev', desc: 'Seed données de dev (faker)' },
    { name: 'db:seed:password', desc: '🔑 Liste tous les comptes de test avec leurs mots de passe' },
    { name: 'db:reset:dev', desc: 'Reset complet (DROP + migrations) DEV UNIQUEMENT' },
    { name: 'db:seed:dev -- --reset', desc: 'Reset + seed (préférer reset puis seed séparés)' },
    { name: 'db:clean-tokens', desc: 'Nettoie les tokens expirés' }
  ] },
  { title: '👤 Administration', color: colors.yellow, scripts: [
    { name: 'admin:list', desc: 'Liste les super administrateurs' },
    { name: 'admin:add <email>', desc: 'Ajoute un super admin' },
    { name: 'admin:remove <email>', desc: 'Retire un super admin' }
  ] },
  { title: '🌐 Internationalisation (i18n)', color: colors.cyan, scripts: [
    { name: 'check-i18n', desc: 'Analyse clés manquantes/inutilisées/dupliquées/hardcodées' },
    { name: 'check-i18n -- -s 1', desc: 'Clés manquantes seulement' },
    { name: 'check-i18n -- -s 2', desc: 'Clés inutilisées seulement' },
    { name: 'check-i18n -- -s 3', desc: 'Valeurs dupliquées seulement' },
    { name: 'check-i18n -- -s 4', desc: 'Textes hardcodés seulement' },
    { name: 'check-i18n -- --delete-unused', desc: 'Supprime automatiquement les clés inutilisées (avec confirmation)' },
    { name: 'check-i18n -- -s 2 -d', desc: 'Clés inutilisées + suppression automatique' },
    { name: 'check-i18n -- -h', desc: 'Aide détaillée' },
    { name: 'check-translations', desc: 'Compare les traductions entre locales' },
    { name: 'check-translations -- -l es', desc: 'Limité à une locale' },
  { name: 'check-translations -- -s', desc: 'Résumé uniquement' },
  { name: 'check-translations -- -p', desc: 'Prune: supprime les clés en trop (diff vs référence)' },
  { name: 'check-translations -- -p -r fr', desc: 'Prune avec référence explicite (ex: fr)' },
  { name: 'check-translations -- -f', desc: 'Fill: ajoute les clés manquantes (copie valeurs de la référence)' },
  { name: 'check-translations -- -f -p', desc: 'Fill puis prune (synchronisation complète)' },
  { name: 'check-translations -- -f --fill-mode todo', desc: 'Marque les clés à traduire: préfixe [TODO]' },
  { name: 'check-translations -- -f --fill-mode empty', desc: 'Ajoute les clés manquantes avec valeur vide' },
  { name: 'check-translations -- -f --fill-mode todo --refill', desc: 'Re-marque aussi les clés déjà identiques à la référence' },
  { name: 'check-i18n-vars', desc: '🔍 Vérifie que les variables {xxx} sont cohérentes entre toutes les langues' },
  { name: 'i18n:add "terme"', desc: '✏️ Ajouter interactivement un terme au dictionnaire de traduction' },
  { name: 'i18n:translate', desc: '🤖 Traduction automatique DeepL (mode incrémental - nouvelles clés uniquement)' },
  { name: 'i18n:translate:force', desc: '⚡ Traduction automatique DeepL (mode force - retraduit tout)' }
  ] },
  { title: '🔄 Système de traduction avancé (scripts/translation/)', color: colors.cyan, scripts: [
    { name: 'scripts/translation/list-todo-keys.js', desc: '🔍 Diagnostic des clés [TODO] + génération template' },
    { name: 'scripts/translation/apply-translations.js --validate', desc: '✅ Validation du fichier de configuration' },
    { name: 'scripts/translation/apply-translations.js', desc: '🚀 Application des traductions depuis la config JSON' },
    { name: 'scripts/translation/apply-translations.js --help', desc: '📖 Aide détaillée du système de traduction' }
  ] },
  { title: '🧹 Qualité & formatage', color: colors.yellow, scripts: [
    { name: 'lint', desc: 'Analyse lint complète' },
    { name: 'lint:fix', desc: 'Corrige automatiquement' },
    { name: 'format', desc: 'Formate le code' },
    { name: 'format:check', desc: 'Vérifie le format' }
  ] },
  { title: '🧪 Tests (watch)', color: colors.cyan, scripts: [
    { name: 'test', desc: 'Tests unitaires watch' },
    { name: 'test:unit', desc: 'Alias tests unitaires watch' },
    { name: 'test:nuxt', desc: 'Tests Nuxt (watch)' },
    { name: 'test:e2e', desc: 'Tests end-to-end (watch)' },
    { name: 'test:db', desc: 'Tests intégration DB (watch)' },
    { name: 'test:ui', desc: 'Interface graphique Vitest' }
  ] },
  { title: '🧪 Tests (one-shot / CI)', color: colors.cyan, scripts: [
    { name: 'test:run', desc: 'Unitaires one-shot' },
    { name: 'test:unit:run', desc: 'Alias unitaire one-shot' },
    { name: 'test:nuxt:run', desc: 'Nuxt one-shot' },
    { name: 'test:e2e:run', desc: 'E2E one-shot' },
    { name: 'test:db:run', desc: 'Intégration DB one-shot' },
    { name: 'test:all', desc: 'Unit + Nuxt + E2E enchaînés' }
  ] },
  { title: '🧪 Tests (environnement docker)', color: colors.blue, scripts: [
    { name: 'test:setup', desc: 'Démarre MySQL pour les tests' },
    { name: 'test:teardown', desc: 'Arrête & nettoie environnement test' }
  ] },
  { title: '🐳 Docker - développement & release', color: colors.blue, scripts: [
    { name: 'docker:dev', desc: 'Env dev (build + up)' },
    { name: 'docker:dev:detached', desc: 'Env dev détaché' },
    { name: 'docker:dev:down', desc: 'Stoppe services dev' },
    { name: 'docker:dev:logs', desc: 'Logs application' },
    { name: 'docker:dev:exec', desc: 'Shell conteneur app' },
    { name: 'docker:release:up', desc: 'Env release local' },
    { name: 'docker:release:down', desc: 'Arrête env release' }
  ] },
  { title: '🐳 Docker - tests', color: colors.blue, scripts: [
    { name: 'docker:test', desc: 'Tous les tests (runner global)' },
    { name: 'docker:test:rebuild', desc: 'Rebuild images test (no-cache)' },
    { name: 'docker:test:clean', desc: 'Nettoyage conteneurs/volumes tests' },
    { name: 'docker:test:unit', desc: 'Tests unitaires container' },
    { name: 'docker:test:unit:clean', desc: 'Nettoyage env unitaires' },
    { name: 'docker:test:integration', desc: 'Tests intégration DB container' },
    { name: 'docker:test:integration:clean', desc: 'Nettoyage env intégration DB' },
    { name: 'docker:test:ui', desc: 'UI Vitest container' },
    { name: 'docker:test:ui:clean', desc: 'Nettoyage env UI tests' }
  ] },
  { title: '🗺️ Domaine métier', color: colors.magenta, scripts: [
    { name: 'geocode', desc: 'Ajoute les coordonnées GPS aux conventions' }
  ] },
  { title: '🖼️ Assets & PWA', color: colors.yellow, scripts: [
    { name: 'favicons', desc: 'Génère les variantes PNG + manifest PWA (à relancer après modif du SVG)' }
  ] }
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

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`${colors.bold}${colors.yellow}💡 Usage:${colors.reset}`)
  console.log(`  ${colors.green}npm run help${colors.reset} - Affiche cette aide`)
  console.log(`  ${colors.green}npm run help -- --help${colors.reset} - Affiche l'aide détaillée`)
  console.log()
}