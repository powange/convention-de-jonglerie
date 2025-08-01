#!/usr/bin/env node

// Migration pour base de données de test
process.env.DATABASE_URL = "mysql://testuser:testpassword@localhost:3307/convention_jonglerie_test";

import { execSync } from 'child_process';

try {
  console.log('🔄 Application des migrations sur la base de données de test...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations appliquées avec succès !');
} catch (error) {
  console.error('❌ Erreur lors de l\'application des migrations:', error.message);
  process.exit(1);
}