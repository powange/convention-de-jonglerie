#!/usr/bin/env node
/**
 * Régénère `app/utils/emoji-shortcodes.json` depuis la table de l'éditeur.
 *
 * L'éditeur (Tiptap, extension Emoji) enregistre les emojis sous forme de raccourci —
 * `:performing_arts:` — dans le markdown. Le rendu doit donc disposer de la même table pour
 * afficher ce que l'auteur a vu. On la fige dans un JSON plutôt que d'importer l'extension au
 * rendu : celle-ci pèse 650 Ko et tire ProseMirror derrière elle, pour un dictionnaire de
 * 55 Ko.
 *
 * Le test `test/unit/utils/emoji-shortcodes-sync.test.ts` refuse tout écart entre ce fichier et
 * la table de l'extension : après une montée de version de Tiptap, il indique s'il faut
 * relancer ce script.
 *
 *   node scripts/generate-emoji-shortcodes.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitHubEmojis } from '@tiptap/extension-emoji'

/**
 * Construit la table raccourci → caractère.
 *
 * On indexe sur `name` **et** sur `shortcodes` : c'est `name` que l'éditeur écrit dans le
 * markdown, et il ne figure pas toujours parmi les `shortcodes` (284 cas). Les entrées propres
 * à GitHub (`:octocat:`, `:atom:`…) n'ont pas de caractère Unicode, seulement une image : elles
 * sont laissées de côté, et leur raccourci restera affiché tel quel.
 */
export function construireTable(emojis) {
  const table = {}
  for (const emoji of emojis) {
    if (!emoji.emoji) continue
    for (const raccourci of new Set([emoji.name, ...(emoji.shortcodes || [])])) {
      if (raccourci) table[raccourci] = emoji.emoji
    }
  }
  // Tri par point de code, et non `localeCompare` : l'ordre doit être le même partout, sinon
  // une régénération sur une autre machine produirait un diff sans changement réel.
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)))
}

// ── Ligne de commande ──────────────────────────────────────────────────────────
// Le test de synchronisation importe `construireTable` : sans cette garde, l'import
// réécrirait le fichier que le test est censé vérifier, et celui-ci ne pourrait jamais échouer.
if (import.meta.url === `file://${process.argv[1]}`) {
  const destination = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'app',
    'utils',
    'emoji-shortcodes.json'
  )

  const table = construireTable(gitHubEmojis)
  writeFileSync(destination, JSON.stringify(table, null, 2) + '\n')
  console.log(`✅ ${Object.keys(table).length} raccourcis écrits dans ${destination}`)
}
