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
  'app.description',
  'admin.view_all_users',
  'admin.view_activity',
  'navigation.home',
  'navigation.editions',
  'navigation.conventions',
  'navigation.favorites',
  'navigation.no_favorites_description',
  'navigation.register',
  'homepage.convention_name',
  'homepage.search_by_name',
  'homepage.select_countries',
  'homepage.dates',
  'homepage.from_date',
  'homepage.to_date',
  'homepage.select_date',
  'homepage.no_editions_found',
  'homepage.no_editions_description',
  'homepage.loading_editions',
  'common.welcome',
  'common.warning',
  'common.save',
  'common.search',
  'common.yes',
  'common.no',
  'common.required',
  'common.phone',
  'common.language',
  'common.preview',
  'auth.forgot_password',
  'auth.no_account',
  'auth.email_or_username',
  'auth.no_account_question',
  'auth.register_link',
  'editions.title',
  'editions.my_editions',
  'editions.create',
  'editions.delete',
  'editions.start_date',
  'editions.end_date',
  'editions.address',
  'editions.collaborators',
  'editions.uploading',
  'conventions.title',
  'conventions.logo',
  'conventions.author',
  'carpool.offers',
  'carpool.requests',
  'carpool.create_offer',
  'carpool.create_request',
  'carpool.departure_city',
  'carpool.departure_date',
  'carpool.available_seats',
  'carpool.seats_needed',
  'carpool.comments',
  'profile.title',
  'profile.edit',
  'profile.user_information',
  'profile.account_settings',
  'profile.profile_stats',
  'profile.update_profile',
  'profile.upload_picture',
  'profile.remove_picture',
  'profile.change_photo',
  'profile.deleting',
  'profile.uploading',
  'profile.cannot_delete_photo',
  'messages.logout_success',
  'messages.profile_updated',
  'messages.convention_deleted',
  'upload.deleting',
  'upload.errors.no_auth_token',
  'errors.email_or_username_required',
  'errors.confirm_password_required',
  'errors.convention_created_image_failed',
  'errors.validation_error',
  'errors.unauthorized',
  'errors.not_found',
  'errors.no_auth_token',
  'errors.login_required_edition',
  'errors.convention_updated_image_failed',
  'feedback.error.required_fields'
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
