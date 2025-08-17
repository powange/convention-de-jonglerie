#!/usr/bin/env node

import { execSync } from 'child_process';

// Migration pour base de données de test (aligne avec docker-compose.test.yml)
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://convention_user:convention_password@localhost:3307/convention_db";

try {
  console.log('🔄 Application des migrations sur la base de données de test...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations appliquées avec succès !');
} catch (error) {
  console.error('❌ Erreur lors de l\'application des migrations:', error.message);
  process.exit(1);
}