#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

const projectRoot = path.resolve(__dirname, '..');
const localesDir = path.join(projectRoot, 'i18n', 'locales');

function loadLocaleFiles() {
  const locales = {};
  const files = fs.readdirSync(localesDir).filter(file => file.endsWith('.json'));
  
  for (const file of files) {
    const locale = file.replace('.json', '');
    const filePath = path.join(localesDir, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      locales[locale] = JSON.parse(content);
    } catch (error) {
      console.error(`${RED}Erreur lors du chargement de ${file}:${RESET}`, error.message);
    }
  }
  
  return locales;
}

function flattenObject(obj, prefix = '') {
  let result = {};
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], fullKey));
    } else {
      result[fullKey] = obj[key];
    }
  }
  
  return result;
}

function compareTranslations(locales, referenceLocale = 'fr') {
  if (!locales[referenceLocale]) {
    console.error(`${RED}Erreur: Le fichier de référence ${referenceLocale}.json n'existe pas${RESET}`);
    process.exit(1);
  }
  
  const referenceKeys = new Set(Object.keys(flattenObject(locales[referenceLocale])));
  const results = {};
  
  for (const [locale, data] of Object.entries(locales)) {
    if (locale === referenceLocale) continue;
    
    const localeKeys = new Set(Object.keys(flattenObject(data)));
    
    // Clés manquantes dans cette langue
    const missingKeys = [...referenceKeys].filter(key => !localeKeys.has(key));
    
    // Clés en trop dans cette langue
    const extraKeys = [...localeKeys].filter(key => !referenceKeys.has(key));
    
    results[locale] = {
      missingKeys,
      extraKeys,
      totalKeys: localeKeys.size,
      referenceTotal: referenceKeys.size
    };
  }
  
  return results;
}

function showHelp() {
  console.log(`
${BOLD}${BLUE}Comparaison des traductions i18n${RESET}

${BOLD}Usage:${RESET}
  npm run check-translations [options]

${BOLD}Options:${RESET}
  -r, --reference <locale>  Langue de référence (défaut: fr)
  -l, --lang <locale>       Affiche uniquement les résultats pour cette langue
  -s, --summary            Affiche uniquement le résumé
  -h, --help               Affiche cette aide

${BOLD}Exemples:${RESET}
  npm run check-translations                    # Compare toutes les langues avec fr
  npm run check-translations -- -r en          # Utilise en comme référence
  npm run check-translations -- -l es          # Affiche uniquement les résultats pour es
  npm run check-translations -- --summary      # Affiche uniquement le résumé
  npm run check-translations -- -h             # Affiche cette aide
`);
}

async function main() {
  // Parse les arguments
  const options = {
    reference: {
      type: 'string',
      short: 'r',
      description: 'Langue de référence'
    },
    lang: {
      type: 'string',
      short: 'l',
      description: 'Langue spécifique à analyser'
    },
    summary: {
      type: 'boolean',
      short: 's',
      description: 'Affiche uniquement le résumé'
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Affiche l\'aide'
    }
  };
  
  let args;
  try {
    args = parseArgs({ options, allowPositionals: false });
  } catch (error) {
    console.error(`${RED}Erreur: ${error.message}${RESET}`);
    showHelp();
    process.exit(1);
  }
  
  if (args.values.help) {
    showHelp();
    process.exit(0);
  }
  
  const referenceLocale = args.values.reference || 'fr';
  const targetLang = args.values.lang;
  const summaryOnly = args.values.summary;
  
  console.log(`\n${BOLD}${BLUE}=== Comparaison des traductions ===${RESET}\n`);
  
  // Charger tous les fichiers de locale
  const locales = loadLocaleFiles();
  const availableLocales = Object.keys(locales).sort();
  
  console.log(`${CYAN}Langues disponibles: ${availableLocales.join(', ')}${RESET}`);
  console.log(`${CYAN}Langue de référence: ${referenceLocale}${RESET}\n`);
  
  if (!locales[referenceLocale]) {
    console.error(`${RED}Erreur: Le fichier ${referenceLocale}.json n'existe pas${RESET}`);
    process.exit(1);
  }
  
  if (targetLang && !locales[targetLang]) {
    console.error(`${RED}Erreur: Le fichier ${targetLang}.json n'existe pas${RESET}`);
    process.exit(1);
  }
  
  // Comparer les traductions
  const results = compareTranslations(locales, referenceLocale);
  
  let hasErrors = false;
  let totalMissing = 0;
  let totalExtra = 0;
  
  // Filtrer par langue si spécifié
  const languagesToShow = targetLang ? { [targetLang]: results[targetLang] } : results;
  
  for (const [locale, data] of Object.entries(languagesToShow)) {
    totalMissing += data.missingKeys.length;
    totalExtra += data.extraKeys.length;
    
    if (data.missingKeys.length > 0) hasErrors = true;
    
    if (!summaryOnly) {
      console.log(`${BOLD}${BLUE}=== ${locale.toUpperCase()} ===${RESET}`);
      
      // Statistiques
      const coverage = ((data.totalKeys / data.referenceTotal) * 100).toFixed(1);
      console.log(`Couverture: ${data.totalKeys}/${data.referenceTotal} clés (${coverage}%)`);
      
      // Clés manquantes
      if (data.missingKeys.length > 0) {
        console.log(`\n${RED}✗ ${data.missingKeys.length} clé(s) manquante(s):${RESET}`);
        data.missingKeys.forEach(key => console.log(`  ${RED}- ${key}${RESET}`));
      } else {
        console.log(`\n${GREEN}✓ Toutes les clés de référence sont présentes${RESET}`);
      }
      
      // Clés en trop
      if (data.extraKeys.length > 0) {
        console.log(`\n${YELLOW}⚠ ${data.extraKeys.length} clé(s) en trop (absente(s) de ${referenceLocale}):${RESET}`);
        data.extraKeys.forEach(key => console.log(`  ${YELLOW}+ ${key}${RESET}`));
      } else {
        console.log(`\n${GREEN}✓ Aucune clé en trop${RESET}`);
      }
      
      console.log('');
    }
  }
  
  // Résumé
  console.log(`${BOLD}${BLUE}=== Résumé ===${RESET}`);
  const referenceTotal = Object.keys(flattenObject(locales[referenceLocale])).length;
  console.log(`Total de clés dans ${referenceLocale}: ${referenceTotal}`);
  
  for (const [locale, data] of Object.entries(languagesToShow)) {
    const coverage = ((data.totalKeys / data.referenceTotal) * 100).toFixed(1);
    const status = data.missingKeys.length === 0 ? GREEN + '✓' : RED + '✗';
    console.log(`${locale}: ${data.totalKeys} clés (${coverage}%) ${status}${RESET} ${data.missingKeys.length > 0 ? `${data.missingKeys.length} manquantes` : ''}`);
  }
  
  if (!targetLang && !summaryOnly) {
    console.log(`\nTotal clés manquantes: ${totalMissing}`);
    console.log(`Total clés en trop: ${totalExtra}`);
  }
  
  // Code de sortie
  if (hasErrors) {
    process.exit(1);
  }
}

main();