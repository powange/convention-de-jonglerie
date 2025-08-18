#!/usr/bin/env node

// Lancement des tests d'intégration avec DB (depuis Docker)
import { execSync } from 'child_process';

process.env.TEST_WITH_DB = 'true';

try {
  // Lancer directement les tests avec la config d'intégration
  console.log('🚀 Exécution des tests d\'intégration...');
  
  // Si le fichier vitest.config.integration.ts existe, l'utiliser
  try {
    execSync('test -f vitest.config.integration.ts', { stdio: 'ignore' });
    execSync('npx vitest run --config vitest.config.integration.ts', { stdio: 'inherit' });
  } catch {
    // Sinon utiliser la config unitaire avec TEST_WITH_DB (fallback minimal)
    execSync('npx vitest run --config vitest.config.unit.ts', { stdio: 'inherit' });
  }
  
  console.log('✅ Tests d\'intégration terminés !');
} catch (error) {
  console.error('❌ Erreur lors des tests d\'intégration:', error.message);
  process.exit(1);
}