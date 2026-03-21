#!/usr/bin/env node

import { spawn } from 'child_process'

import { select } from '@inquirer/prompts'

/**
 * Wrapper select avec support Echap.
 * En raw mode, Echap arrive comme le byte 0x1b (27) sur stdin.
 * Utilise promise.cancel() car AbortController ne fonctionne pas avec @inquirer/select.
 */
async function selectWithEscape(options) {
  const promise = select(options)

  const onData = (data) => {
    if (data.length === 1 && data[0] === 27) {
      promise.cancel()
    }
  }

  process.stdin.prependListener('data', onData)

  try {
    return await promise
  } finally {
    process.stdin.removeListener('data', onData)
  }
}

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
      { name: 'db:e2e:accounts', desc: 'Liste les comptes créés par les tests E2E' },
      { name: 'db:e2e:clean', desc: 'Supprime les comptes créés par les tests E2E' },
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
        name: 'check-translations -- -l',
        desc: 'Résultats pour une seule langue',
        requiresArg: '<locale>',
      },
      {
        name: 'check-translations -- -f --fill-mode todo',
        desc: 'Marque les clés manquantes avec [TODO]',
      },
      {
        name: 'check-translations -- -f',
        desc: 'Copie les clés manquantes depuis la référence',
      },
      {
        name: 'check-translations -- --refill --fill-mode todo',
        desc: 'Remarque aussi les valeurs identiques à la ref comme [TODO]',
      },
      {
        name: 'check-translations -- -p',
        desc: 'Supprime les clés en trop (prune)',
      },
      {
        name: 'check-translations -- --fix-structure',
        desc: 'Réorganise les clés mal placées vers les bons fichiers',
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
      { name: 'test:playwright', desc: 'Tests E2E Playwright (navigateur)' },
      { name: 'test:playwright:ui', desc: 'Playwright avec interface graphique' },
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
      {
        name: 'docker:dev:clean-modules',
        desc: 'Supprime le volume node_modules Docker',
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

  // Sélection de la catégorie
  let category
  try {
    const categoryChoices = [
      ...sections.map((s, i) => ({
        name: `${colors.dim}${String(i + 1).padStart(2)}.${colors.reset} ${s.icon} ${s.title} ${colors.dim}(${s.scripts.length} scripts)${colors.reset}`,
        value: s,
      })),
      { name: `${colors.dim} 0.${colors.reset} 📋 Afficher la liste complète`, value: 'list' },
    ]

    category = await selectWithEscape({
      message: 'Choisissez une catégorie :',
      choices: categoryChoices,
      pageSize: categoryChoices.length,
      loop: false,
    })
  } catch {
    // Echap ou Ctrl+C au menu principal → quitter
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

  let script
  try {
    const scriptChoices = category.scripts.map((s, i) => {
      const arg = s.requiresArg ? ` ${colors.yellow}${s.requiresArg}${colors.reset}` : ''
      return {
        name: `${colors.dim}${String(i + 1).padStart(2)}.${colors.reset} ${colors.green}${s.name}${arg}${colors.reset} ${colors.dim}- ${s.desc}${colors.reset}`,
        value: s,
      }
    })

    script = await selectWithEscape({
      message: `Choisissez un script ${colors.dim}(Echap = retour)${colors.reset} :`,
      choices: scriptChoices,
      pageSize: scriptChoices.length,
      loop: false,
    })
  } catch {
    // Echap ou Ctrl+C au menu script → retour aux catégories
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
}

/**
 * Résout un raccourci clavier en index de section/script.
 * "1" → 0, "9" → 8, "0" → 9, "a" → 10, "b" → 11, etc.
 */
function resolveShortcutIndex(shortcut) {
  if (!shortcut || shortcut.length !== 1) return -1
  const code = shortcut.charCodeAt(0)
  if (code >= 49 && code <= 57) return code - 49 // '1'-'9' → 0-8
  if (code === 48) return 9 // '0' → 9
  if (code >= 97 && code <= 122) return code - 97 + 10 // 'a'-'z' → 10+
  return -1
}

/**
 * Mode direct : `npm run help 2 6` → catégorie 2, script 6
 */
async function directMode(categoryShortcut, scriptShortcut) {
  const categoryIndex = resolveShortcutIndex(categoryShortcut)
  if (categoryIndex < 0 || categoryIndex >= sections.length) {
    console.log(`${colors.red}❌ Catégorie "${categoryShortcut}" invalide${colors.reset}`)
    console.log(`${colors.dim}Catégories disponibles : 1-${Math.min(9, sections.length)}${sections.length > 9 ? ', 0' : ''}${sections.length > 10 ? ', a-' + String.fromCharCode(96 + sections.length - 10) : ''}${colors.reset}`)
    process.exit(1)
  }

  const section = sections[categoryIndex]

  if (!scriptShortcut) {
    // Afficher les scripts de la catégorie puis passer en mode interactif
    console.log(`${colors.bold}${section.color}${section.icon} ${section.title}${colors.reset}\n`)

    const scriptChoices = section.scripts.map((s, i) => {
      const arg = s.requiresArg ? ` ${colors.yellow}${s.requiresArg}${colors.reset}` : ''
      return {
        name: `${colors.dim}${String(i + 1).padStart(2)}.${colors.reset} ${colors.green}${s.name}${arg}${colors.reset} ${colors.dim}- ${s.desc}${colors.reset}`,
        value: s,
      }
    })

    let script
    try {
      script = await selectWithEscape({
        message: `Choisissez un script ${colors.dim}(Echap = retour)${colors.reset} :`,
        choices: scriptChoices,
        pageSize: scriptChoices.length,
        loop: false,
      })
    } catch {
      // Echap ou Ctrl+C → retour au menu principal
      return interactiveMenu()
    }

    if (script.requiresArg) {
      console.log(`\n${colors.yellow}⚠️  Ce script nécessite un argument : ${script.requiresArg}${colors.reset}`)
      console.log(`${colors.dim}Exécutez : ${colors.green}npm run ${script.name} ${script.requiresArg}${colors.reset}\n`)
      process.exit(1)
    }

    runScript(script.name)
    return
  }

  const scriptIndex = resolveShortcutIndex(scriptShortcut)
  if (scriptIndex < 0 || scriptIndex >= section.scripts.length) {
    console.log(`${colors.red}❌ Script "${scriptShortcut}" invalide dans ${section.title}${colors.reset}`)
    console.log(`${colors.dim}Scripts disponibles : 1-${Math.min(9, section.scripts.length)}${colors.reset}`)
    process.exit(1)
  }

  const script = section.scripts[scriptIndex]

  if (script.requiresArg) {
    console.log(`${colors.yellow}⚠️  Ce script nécessite un argument : ${script.requiresArg}${colors.reset}`)
    console.log(`${colors.dim}Exécutez : ${colors.green}npm run ${script.name} ${script.requiresArg}${colors.reset}`)
    process.exit(1)
  }

  runScript(script.name)
}

// Point d'entrée
const args = process.argv.slice(2)
if (args.includes('--list') || args.includes('-l')) {
  showStaticHelp()
} else if (args.length > 0 && !args[0].startsWith('-')) {
  directMode(args[0], args[1])
} else {
  interactiveMenu()
}
