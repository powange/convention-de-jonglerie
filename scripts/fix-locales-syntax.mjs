#!/usr/bin/env node
// Script de réparation syntaxique des fichiers de locales (suppression des virgules traînantes)
// Cible: es, it, nl, pl, pt, ru, uk
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const targetCodes = ['es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk']
const baseDir = new URL('..', import.meta.url).pathname
const localesDir = join(baseDir, 'i18n', 'locales')

let failures = 0
for (const code of targetCodes) {
  const file = join(localesDir, code + '.json')
  try {
    const raw = readFileSync(file, 'utf8')
    let sanitized = raw.replace(/^\uFEFF/, '')
    // 1. Retirer virgules traînantes
    sanitized = sanitized.replace(/,([ \t\r\n]*[}\]])/g, '$1')
    sanitized = sanitized.replace(/,,+/g, ',')

    // 2. Ajouter virgules manquantes entre propriétés adjacentes
    let lines = sanitized.split(/\n/)
    const isPropLine = (l) => /^\s*"[^"\n]+"\s*:/.test(l)
    const endsWithComma = (l) => /,\s*(?:\/\/.*)?$/.test(l)
    const isBlockStart = (l) => /{\s*$/.test(l)
    const isBlockEnd = (l) => /^\s*}[,]?\s*$/.test(l)
    for (let i = 1; i < lines.length; i++) {
      const curr = lines[i]
      if (isPropLine(curr)) {
        // Chercher ligne précédente significative
        let j = i - 1
        while (j >= 0 && /^\s*$/.test(lines[j])) j--
        if (j >= 0) {
          const prev = lines[j]
            // Si la précédente est une propriété ou fin de bloc sans virgule et pas début d'objet racine
          if (!endsWithComma(prev) && !isBlockStart(prev) && !/^\s*{\s*$/.test(prev) && !/^\s*\[\s*$/.test(prev) && !/^\s*}$/.test(prev)) {
            lines[j] = prev + ','
          }
        }
      }
    }
    sanitized = lines.join('\n')

    // 3. Retenter parse, si encore échec, log et passer
    let parsed
    try {
      parsed = JSON.parse(sanitized)
    } catch (e) {
      console.error(`❌ Échec parsing après tentative de réparation pour ${code}:`, e.message)
      failures++
      continue
    }

    writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
    console.log(`✔ Locale ${code} corrigée`)
  } catch (e) {
    console.error(`❌ Impossible de traiter ${code}:`, e.message)
    failures++
  }
}

if (failures) {
  console.error(`Terminé avec ${failures} échec(s)`) 
  process.exitCode = 1
} else {
  console.log('Toutes les locales ciblées ont été normalisées.')
}
