#!/usr/bin/env node
/*
  Script: prune-i18n.cjs
  Objet: Supprimer les clés i18n marquées "inutilisées" par le dernier check-i18n
  Action: Nettoie i18n/locales/fr.json et i18n/locales/en.json
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FR_PATH = path.join(ROOT, 'i18n', 'locales', 'fr.json');
const EN_PATH = path.join(ROOT, 'i18n', 'locales', 'en.json');

// Liste figée issue du dernier `npm run check-i18n`
const UNUSED_KEYS = [
  'messages.offer_updated',
  'messages.carpool_proposed',
  'messages.offer_updated_successfully',
  'messages.carpool_offer_published',
  'messages.request_updated',
  'messages.request_published',
  'messages.request_updated_successfully',
  'messages.carpool_request_published',
  'errors.leaflet_unavailable',
  'errors.leaflet_loading_error',
  'errors.cannot_update_offer',
  'errors.cannot_create_carpool_offer',
  'errors.cannot_update_request',
  'errors.cannot_create_carpool_request',
  'forms.placeholders.select_date',
  'forms.placeholders.departure_details',
  'forms.placeholders.carpool_offer_details',
  'forms.placeholders.carpool_request_details',
  'forms.placeholders.departure_city',
  'forms.placeholders.phone_example',
  'forms.labels.departure_city',
  'forms.labels.departure_location',
  'forms.labels.phone_number',
  'forms.labels.additional_info',
  'forms.buttons.updating'
];

function loadJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function saveJson(p, obj) {
  const content = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(p, content, 'utf8');
}

function deleteByPath(obj, dottedPath) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur && typeof cur === 'object' && parts[i] in cur) {
      cur = cur[parts[i]];
    } else {
      return false; // rien à supprimer
    }
  }
  const last = parts[parts.length - 1];
  if (cur && typeof cur === 'object' && last in cur) {
    delete cur[last];
    return true;
  }
  return false;
}

function prune(filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) return { filePath, removed: 0 };
  const data = loadJson(filePath);
  let removed = 0;
  for (const key of UNUSED_KEYS) {
    if (deleteByPath(data, key)) removed++;
  }
  saveJson(filePath, data);
  return { filePath, removed };
}

const results = [prune(FR_PATH), prune(EN_PATH)];
for (const r of results) {
  console.log(`Pruned ${r.removed} key(s) from ${path.relative(ROOT, r.filePath)}`);
}
