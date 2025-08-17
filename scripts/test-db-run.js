#!/usr/bin/env node
import { execSync } from 'child_process';

// Lancement des tests d'intégration avec DB
process.env.TEST_WITH_DB = 'true';

try {
  console.log('🧪 Lancement des tests d\'intégration avec DB...');
  
  // S'assurer que la DB est démarrée et les migrations appliquées
  console.log('🐳 Vérification de la base de données de test...');
  execSync('docker-compose -f docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  
  console.log('📋 Application des migrations...');
  execSync('node scripts/migrate-test.js', { stdio: 'inherit' });
  
  // Lancer les tests
  execSync('npx vitest run --config vitest.config.integration.ts', { stdio: 'inherit' });
  console.log('✅ Tests d\'intégration terminés !');
} catch (error) {
  console.error('❌ Erreur lors des tests d\'intégration:', error.message);
  process.exit(1);
}