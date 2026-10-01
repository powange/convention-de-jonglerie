#!/usr/bin/env node

import { execSync } from 'child_process'

/*
 * Migration de la base de TEST (alignée sur docker-compose.test.yml).
 *
 * ⚠️ DEUX DÉFAUTS ICI, et le second était silencieux.
 *
 * (1) Le repli visait `3308/convention_db` : sur la pile de développement, le PORT de la base
 *     MIROIR avec le NOM de la base de travail. Il désigne désormais le conteneur de test (3310),
 *     dont la base s'appelle `convention_db_test`.
 *
 * (2) `process.env.DATABASE_URL || …` laissait passer un `DATABASE_URL` hérité du `.env` de
 *     développement : lancer ce script depuis l'hôte appliquait alors les migrations à LA BASE DE
 *     TRAVAIL. `migrate deploy` est idempotent, donc rien ne cassait et rien ne le disait — mais le
 *     script « de test » touchait la base de dev, et c'est le même glissement qui a permis à
 *     `cleanDatabase` de la vider. `TEST_DATABASE_URL` passe maintenant d'abord, et le nom de la
 *     base doit contenir « test ».
 */
const urlDeTest =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'mysql://convention_user:convention_password@localhost:3310/convention_db_test'

const nomDeBase = (() => {
  try {
    return new URL(urlDeTest).pathname.slice(1)
  } catch {
    return ''
  }
})()

if (!nomDeBase.includes('test')) {
  console.error(
    `❌ Refus de migrer la base « ${nomDeBase || '(inconnue)'} » : son nom ne contient pas « test ».\n` +
      `   Démarrez la base de test (npm run test:setup, port 3310) ou passez TEST_DATABASE_URL.`
  )
  process.exit(1)
}

process.env.DATABASE_URL = urlDeTest

try {
  console.log('🔄 Application des migrations sur la base de données de test...')
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  console.log('🛠️ Génération du client Prisma...')
  execSync('npx prisma generate', { stdio: 'inherit' })
  console.log('✅ Migrations appliquées avec succès !')
} catch (error) {
  console.error("❌ Erreur lors de l'application des migrations:", error.message)
  process.exit(1)
}
