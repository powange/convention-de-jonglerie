#!/usr/bin/env node
/*
  Script: normalize-locales.cjs
  - Référence: i18n/locales/fr.json
  - Pour chaque locale (.json) dans i18n/locales sauf fr:
    • Supprime les clés absentes de fr (extra)
    • Ajoute les clés manquantes en copiant la valeur de en.json si dispo, sinon fr.json
*/
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.resolve(__dirname, '..', 'i18n', 'locales');
const FR = path.join(LOCALES_DIR, 'fr.json');
const EN = path.join(LOCALES_DIR, 'en.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveJson(p, obj) {
  const content = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(p, content, 'utf8');
}

function walk(obj, prefix = '') {
  const keys = new Set();
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
        // allow nested objects
        const nested = walk(obj[k], p);
        for (const n of nested) keys.add(n);
      } else {
        keys.add(p);
      }
    }
  }
  return keys;
}

function get(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function ensureSet(obj, dotted, value) {
  const parts = dotted.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const part of parts) {
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[last] = value;
}

function deletePath(obj, dotted) {
  const parts = dotted.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return false;
    cur = cur[part];
  }
  if (cur && typeof cur === 'object' && last in cur) {
    delete cur[last];
    return true;
  }
  return false;
}

function main() {
  const fr = loadJson(FR);
  const en = fs.existsSync(EN) ? loadJson(EN) : {};
  const frKeys = walk(fr);

  const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
  const targets = files.filter(f => f !== 'fr.json');

  for (const file of targets) {
    const p = path.join(LOCALES_DIR, file);
    const data = loadJson(p);
    const beforeKeys = walk(data);

    // Supprimer les clés en trop
    let removed = 0;
    for (const key of beforeKeys) {
      if (!frKeys.has(key)) {
        if (deletePath(data, key)) removed++;
      }
    }

    // Ajouter les clés manquantes
    let added = 0;
    for (const key of frKeys) {
      const has = get(data, key) !== undefined;
      if (!has) {
        const fallback = get(en, key);
        const value = fallback !== undefined ? fallback : get(fr, key);
        ensureSet(data, key, value);
        added++;
      }
    }

    saveJson(p, data);
    console.log(`${file}: -${removed} extra, +${added} missing`);
  }
}

main();
