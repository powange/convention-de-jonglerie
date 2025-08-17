#!/usr/bin/env node

// Lancement des tests d'intégration avec DB (depuis Docker)
process.env.TEST_WITH_DB = 'true';

import { execSync } from 'child_process';

try {
  // Lancer directement les tests avec la config d'intégration
  console.log('🚀 Exécution des tests d\'intégration...');
  
  // Si le fichier vitest.integration.config.ts existe, l'utiliser
  try {
    execSync('test -f vitest.integration.config.ts', { stdio: 'ignore' });
    execSync('npx vitest run --config vitest.integration.config.ts', { stdio: 'inherit' });
  } catch {
    // Sinon utiliser la config normale avec TEST_WITH_DB
    execSync('npx vitest run --config vitest.config.ts', { stdio: 'inherit' });
  }
  
  console.log('✅ Tests d\'intégration terminés !');
} catch (error) {
  console.error('❌ Erreur lors des tests d\'intégration:', error.message);
  process.exit(1);
}