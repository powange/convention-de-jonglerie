#!/usr/bin/env node

import { spawn } from 'child_process'

import { select } from '@inquirer/prompts'

// Couleurs pour le terminal
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

// Organisation : du quotidien vers le spécialisé
const sections = [
  {
    title: 'Cycle de développement',
    icon: '🚀',
    color: colors.green,
    scripts: [
      { name: 'dev', desc: 'Serveur de dev http://localhost:3000' },
      { name: 'build', desc: 'Build production optimisée' },
      { name: 'preview', desc: 'Prévisualise le build local' },
      { name: 'generate', desc: 'Génère le site statique (SSG)' },
      { name: 'kill-servers', desc: 'Stoppe les serveurs de dev en cours' },
    ],
  },
  {
    title: 'Base de données',
    icon: '🗄️',
    color: colors.magenta,
    scripts: [
      { name: 'db:seed:dev', desc: 'Seed données de dev (faker)' },
      {
        name: 'db:seed:password',
        desc: 'Liste tous les comptes de test avec leurs mots de passe',
      },
      {
        name: 'db:reset:dev',
        desc: 'Reset complet (DROP + migrations) DEV UNIQUEMENT',
      },
      { name: 'db:clean-tokens', desc: 'Nettoie les tokens expirés' },
    ],
  },
  {
    title: 'Administration',
    icon: '👤',
    color: colors.yellow,
    scripts: [
      { name: 'admin:list', desc: 'Liste les super administrateurs' },
      {
        name: 'admin:add',
        desc: 'Ajoute un super admin',
        requiresArg: '<email>',
      },
      {
        name: 'admin:remove',
        desc: 'Retire un super admin',
        requiresArg: '<email>',
      },
    ],
  },
  {
    title: 'Internationalisation (i18n)',
    icon: '🌐',
    color: colors.cyan,
    scripts: [
      {
        name: 'check-i18n',
        desc: 'Analyse clés manquantes/inutilisées/dupliquées/hardcodées',
      },
      {
        name: 'check-i18n -- -s 1',
        desc: 'Clés manquantes seulement',
      },
      {
        name: 'check-i18n -- -s 2',
        desc: 'Clés inutilisées seulement',
      },
      {
        name: 'check-i18n -- -s 3',
        desc: 'Valeurs dupliquées seulement',
      },
      {
        name: 'check-i18n -- -s 4',
        desc: 'Textes hardcodés seulement',
      },
      {
        name: 'check-i18n -- --delete-unused',
        desc: 'Supprime automatiquement les clés inutilisées',
      },
      {
        name: 'check-translations',
        desc: 'Compare les traductions entre locales',
      },
      {
        name: 'check-translations -- -s',
        desc: 'Résumé uniquement',
      },
      {
        name: 'check-translations -- -f --fill-mode todo',
        desc: 'Marque les clés à traduire avec [TODO]',
      },
      {
        name: 'check-i18n-vars',
        desc: 'Vérifie cohérence des variables {xxx} entre langues',
      },
      {
        name: 'i18n:mark-todo',
        desc: 'Marque les clés FR modifiées comme [TODO]',
      },
    ],
  },
  {
    title: 'Qualité & formatage',
    icon: '🧹',
    color: colors.yellow,
    scripts: [
      { name: 'lint', desc: 'Analyse lint complète' },
      { name: 'lint:fix', desc: 'Corrige automatiquement' },
      { name: 'format', desc: 'Formate le code' },
      { name: 'format:check', desc: 'Vérifie le format' },
    ],
  },
  {
    title: 'Tests (watch)',
    icon: '🧪',
    color: colors.cyan,
    scripts: [
      { name: 'test', desc: 'Tests unitaires watch' },
      { name: 'test:unit', desc: 'Alias tests unitaires watch' },
      { name: 'test:nuxt', desc: 'Tests Nuxt (watch)' },
      { name: 'test:e2e', desc: 'Tests end-to-end (watch)' },
      { name: 'test:db', desc: 'Tests intégration DB (watch)' },
      { name: 'test:ui', desc: 'Interface graphique Vitest' },
    ],
  },
  {
    title: 'Tests (one-shot / CI)',
    icon: '✅',
    color: colors.cyan,
    scripts: [
      { name: 'test:run', desc: 'Unitaires one-shot' },
      { name: 'test:unit:run', desc: 'Alias unitaire one-shot' },
      { name: 'test:nuxt:run', desc: 'Nuxt one-shot' },
      { name: 'test:e2e:run', desc: 'E2E one-shot' },
      { name: 'test:db:run', desc: 'Intégration DB one-shot' },
      { name: 'test:all', desc: 'Unit + Nuxt + E2E enchaînés' },
    ],
  },
  {
    title: 'Tests (environnement docker)',
    icon: '🐋',
    color: colors.blue,
    scripts: [
      { name: 'test:setup', desc: 'Démarre MySQL pour les tests' },
      { name: 'test:teardown', desc: 'Arrête & nettoie environnement test' },
    ],
  },
  {
    title: 'Docker - développement',
    icon: '🐳',
    color: colors.blue,
    scripts: [
      { name: 'docker:dev', desc: 'Env dev (build + up)' },
      { name: 'docker:dev:detached', desc: 'Env dev détaché' },
      { name: 'docker:dev:down', desc: 'Stoppe services dev' },
      { name: 'docker:dev:logs', desc: 'Logs application' },
      { name: 'docker:dev:exec', desc: 'Shell conteneur app' },
      {
        name: 'docker:dev:get-lockfile',
        desc: 'Récupère package-lock.json depuis le conteneur',
      },
      {
        name: 'docker:dev:get-package',
        desc: 'Récupère package.json depuis le conteneur',
      },
    ],
  },
  {
    title: 'Docker - release & tests',
    icon: '📦',
    color: colors.blue,
    scripts: [
      { name: 'docker:release:up', desc: 'Env release local' },
      { name: 'docker:release:down', desc: 'Arrête env release' },
      { name: 'docker:test', desc: 'Tous les tests (runner global)' },
      { name: 'docker:test:rebuild', desc: 'Rebuild images test (no-cache)' },
      { name: 'docker:test:clean', desc: 'Nettoyage conteneurs/volumes tests' },
    ],
  },
  {
    title: 'Domaine métier & Assets',
    icon: '🗺️',
    color: colors.magenta,
    scripts: [
      { name: 'geocode', desc: 'Ajoute les coordonnées GPS aux conventions' },
      {
        name: 'favicons',
        desc: 'Génère les variantes PNG + manifest PWA',
      },
    ],
  },
]

// Mode liste statique (ancien comportement)
function showStaticHelp() {
  console.log(
    `${colors.bold}${colors.blue}📦 Scripts disponibles${colors.reset}\n`
  )

  sections.forEach((section) => {
    console.log(
      `${colors.bold}${section.color}${section.icon} ${section.title}${colors.reset}`
    )
    section.scripts.forEach((script) => {
      const arg = script.requiresArg ? ` ${colors.yellow}${script.requiresArg}${colors.reset}` : ''
      console.log(
        `  ${colors.green}npm run ${script.name}${arg}${colors.reset}${colors.dim} - ${script.desc}${colors.reset}`
      )
    })
    console.log()
  })

  console.log(`${colors.dim}💡 Utilisez ${colors.green}npm run help${colors.dim} sans arguments pour le mode interactif${colors.reset}\n`)
}

// Exécute un script npm
function runScript(scriptName) {
  console.log(
    `\n${colors.bold}${colors.cyan}▶ Exécution: npm run ${scriptName}${colors.reset}\n`
  )

  // Construire la commande complète
  const command = `npm run ${scriptName}`

  const child = spawn(command, {
    stdio: 'inherit',
    shell: true,
  })

  child.on('close', (code) => {
    if (code === 0) {
      console.log(
        `\n${colors.green}✓ Script terminé avec succès${colors.reset}`
      )
    } else {
      console.log(
        `\n${colors.red}✗ Script terminé avec le code ${code}${colors.reset}`
      )
    }
  })
}

// Menu interactif principal
async function interactiveMenu() {
  console.clear()
  console.log(
    `${colors.bold}${colors.blue}📦 Scripts NPM - Menu interactif${colors.reset}\n`
  )

  // Génère un raccourci clavier pour un index donné (1-9, puis 0, a, b, c...)
  const getShortcutKey = (index) => {
    if (index < 9) return String(index + 1) // 1-9
    if (index === 9) return '0' // 10ème = 0
    return String.fromCharCode(97 + index - 10) // a, b, c... pour 11+
  }

  const getShortcutDisplay = (index) => {
    if (index < 9) return String(index + 1)
    if (index === 9) return '0'
    return String.fromCharCode(97 + index - 10)
  }

  try {
    // Sélection de la catégorie avec raccourcis numériques
    const categoryChoices = [
      ...sections.map((s, index) => ({
        name: `${colors.dim}[${getShortcutDisplay(index)}]${colors.reset} ${s.icon} ${s.title} ${colors.dim}(${s.scripts.length} scripts)${colors.reset}`,
        value: s,
        key: getShortcutKey(index),
      })),
      { name: `${colors.dim}───────────────────────────${colors.reset}`, value: 'separator', disabled: true },
      { name: `${colors.dim}[l]${colors.reset} 📋 Afficher la liste complète`, value: 'list', key: 'l' },
      { name: `${colors.dim}[q]${colors.reset} ❌ Quitter`, value: 'exit', key: 'q' },
    ]

    const category = await select({
      message: 'Choisissez une catégorie (ou tapez un numéro):',
      choices: categoryChoices,
      pageSize: 15,
    })

    if (category === 'exit') {
      console.log(`\n${colors.dim}À bientôt !${colors.reset}\n`)
      process.exit(0)
    }

    if (category === 'list') {
      console.clear()
      showStaticHelp()
      console.log(`${colors.dim}Appuyez sur Entrée pour revenir au menu...${colors.reset}`)
      await new Promise((resolve) => {
        process.stdin.once('data', resolve)
      })
      return interactiveMenu()
    }

    // Sélection du script dans la catégorie
    console.clear()
    console.log(
      `${colors.bold}${category.color}${category.icon} ${category.title}${colors.reset}\n`
    )

    const scriptChoices = [
      ...category.scripts.map((s, index) => {
        const arg = s.requiresArg ? ` ${colors.yellow}${s.requiresArg}${colors.reset}` : ''
        return {
          name: `${colors.dim}[${getShortcutDisplay(index)}]${colors.reset} ${colors.green}${s.name}${arg}${colors.reset} ${colors.dim}- ${s.desc}${colors.reset}`,
          value: s,
          key: getShortcutKey(index),
        }
      }),
      { name: `${colors.dim}───────────────────────────${colors.reset}`, value: 'separator', disabled: true },
      { name: `${colors.dim}[b]${colors.reset} ⬅️  Retour aux catégories`, value: 'back', key: 'b' },
      { name: `${colors.dim}[q]${colors.reset} ❌ Quitter`, value: 'exit', key: 'q' },
    ]

    const script = await select({
      message: 'Choisissez un script (ou tapez un numéro):',
      choices: scriptChoices,
      pageSize: 15,
    })

    if (script === 'exit') {
      console.log(`\n${colors.dim}À bientôt !${colors.reset}\n`)
      process.exit(0)
    }

    if (script === 'back') {
      return interactiveMenu()
    }

    // Gestion des scripts nécessitant des arguments
    if (script.requiresArg) {
      console.log(
        `\n${colors.yellow}⚠️  Ce script nécessite un argument: ${script.requiresArg}${colors.reset}`
      )
      console.log(
        `${colors.dim}Exécutez manuellement: ${colors.green}npm run ${script.name} ${script.requiresArg}${colors.reset}\n`
      )
      console.log(`${colors.dim}Appuyez sur Entrée pour revenir au menu...${colors.reset}`)
      await new Promise((resolve) => {
        process.stdin.once('data', resolve)
      })
      return interactiveMenu()
    }

    // Exécution du script
    runScript(script.name)
  } catch (error) {
    // Gestion de Ctrl+C
    if (error.name === 'ExitPromptError' || error.message?.includes('User force closed')) {
      console.log(`\n${colors.dim}À bientôt !${colors.reset}\n`)
      process.exit(0)
    }
    throw error
  }
}

// Point d'entrée
const args = process.argv.slice(2)
if (args.includes('--list') || args.includes('-l')) {
  showStaticHelp()
} else {
  interactiveMenu()
}
