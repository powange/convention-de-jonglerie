#!/usr/bin/env node
/**
 * Script de réparation des fichiers de locales JSON cassés (virgules finales, virgules manquantes, guillemets manquants).
 * Approche:
 * 1. Lecture brute du fichier.
 * 2. Tentative parse strict JSON -> si OK on passe.
 * 3. Sinon: normalisations successives (regex) puis tentative parse JSON5 (fallback) puis re-stringify propre.
 * 4. Sauvegarde fichier formaté (indent=2) uniquement si parse final réussi.
 * 5. Rapport des fichiers réparés / encore en erreur.
 */

import fs from 'node:fs'
import path from 'node:path'

// Lazy import JSON5 si disponible, sinon parser minimal (échoue sur certains cas)
let JSON5
try { JSON5 = await import('json5') } catch (_) { JSON5 = null }

const LOCALES_DIR = path.resolve(process.cwd(), 'i18n/locales')

function listLocaleFiles() {
  return fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))
}

function isValidJsonStrict(txt) {
  try { JSON.parse(txt); return true } catch { return false }
}

function tryParsers(txt) {
  // Try strict
  try { return JSON.parse(txt) } catch (e) { /* ignore strict parse error */ }
  // Try JSON5 if available
  if (JSON5) {
  try { return JSON5.parse(txt) } catch (e) { /* ignore json5 parse error */ }
  }
  return null
}

function normalizeContent(raw) {
  let txt = raw
  txt = txt.replace(/\r\n?/g, '\n') // EOL
  txt = txt.replace(/^\uFEFF/, '') // BOM
  // Retirer commentaires potentiels
  txt = txt.replace(/\/\/[^\n]*$/gm, '')
  txt = txt.replace(/\/\*[\s\S]*?\*\//g, '')

  // Supprimer espaces inutiles en fin de ligne
  txt = txt.replace(/\s+$/gm, '')

  // Agressif: enlever toute virgule précédant immédiatement un } ou ] (multi-pass jusqu'à stabilisation)
  let prev
  do {
    prev = txt
    txt = txt.replace(/,\s*([}\]])/g, '$1')
  } while (txt !== prev)

  // Retirer virgules multiples consécutives
  txt = txt.replace(/,,+/g, ',')

  // Ajouter guillemets autour des clés non citées (si oubli) ; éviter si déjà guillemets ou numérique
  txt = txt.replace(/([,{\n]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, (m, p1, p2) => `${p1}"${p2}":`)

  // Dernière passe trailing comma racine
  txt = txt.replace(/,\s*}\s*$/m, '}')
  return txt
}

function fixFile(file) {
  const full = path.join(LOCALES_DIR, file)
  const original = fs.readFileSync(full, 'utf8')
  if (isValidJsonStrict(original)) {
    return { file, status: 'ok', changed: false }
  }
  const normalized = normalizeContent(original)
  let parsed = tryParsers(normalized)
  if (!parsed) {
    // Tentative supplémentaire: enlever toutes les fins de ligne contenant uniquement une virgule résiduelle
    const lines = normalized.split('\n').filter(l => !/^\s*,$/.test(l))
    const second = lines.join('\n')
    parsed = tryParsers(second)
    if (parsed) {
      // Remplacer normalisé si réussi
      parsed.__SOURCE_FIXED = true
    }
  }
  if (!parsed) {
    return { file, status: 'error', changed: false }
  }
  // Retirer marqueur interne éventuel
  if (parsed.__SOURCE_FIXED) delete parsed.__SOURCE_FIXED
  const pretty = JSON.stringify(parsed, null, 2) + '\n'
  if (pretty !== original) {
    fs.writeFileSync(full, pretty, 'utf8')
    return { file, status: 'fixed', changed: true }
  }
  return { file, status: 'ok', changed: false }
}

function main() {
  const files = listLocaleFiles()
  const results = files.map(fixFile)
  const fixed = results.filter(r => r.status === 'fixed')
  const errors = results.filter(r => r.status === 'error')

  console.log('=== Locales Fix Report ===')
  console.log('Total:', results.length)
  console.log('Fixed:', fixed.length ? fixed.map(r => r.file).join(', ') : 0)
  console.log('Errors:', errors.length ? errors.map(r => r.file).join(', ') : 0)

  if (errors.length) {
    console.log('\nFichiers restant invalides (à corriger manuellement):')
    errors.forEach(e => console.log(' -', e.file))
    process.exitCode = 1
  }
}

main()
