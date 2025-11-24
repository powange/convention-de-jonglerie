// Script pour vérifier les subscriptions d'un utilisateur
// Utilisation: NITRO_PRESET=node node scripts/check-subscriptions.mjs

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../server/generated/prisma/index.js')

const prisma = new PrismaClient()

async function checkSubscriptions() {
  const userId = 79

  console.log(`\n🔍 Vérification des subscriptions pour l'utilisateur ${userId}\n`)

  try {
    // Vérifier les FCM tokens
    const fcmTokens = await prisma.fcmToken.findMany({
      where: { userId },
    })

    console.log(`📲 FCM Tokens: ${fcmTokens.length}`)
    fcmTokens.forEach((token) => {
      console.log(`  - ${token.id}`)
      console.log(`    Actif: ${token.isActive}`)
      console.log(`    Token: ${token.token.substring(0, 30)}...`)
    })

    // Vérifier les push subscriptions VAPID
    const pushSubs = await prisma.pushSubscription.findMany({
      where: { userId },
    })

    console.log(`\n📬 VAPID Subscriptions: ${pushSubs.length}`)
    pushSubs.forEach((sub) => {
      console.log(`  - ${sub.id}`)
      console.log(`    Actif: ${sub.isActive}`)
      console.log(`    Endpoint: ${sub.endpoint.substring(0, 60)}...`)
      console.log(`    Créé: ${sub.createdAt}`)
      console.log(`    Mis à jour: ${sub.updatedAt}`)
    })

    // Statistiques globales
    const stats = await Promise.all([
      prisma.pushSubscription.count(),
      prisma.pushSubscription.count({ where: { isActive: true } }),
      prisma.pushSubscription.count({ where: { isActive: false } }),
    ])

    console.log(`\n📊 Statistiques globales:`)
    console.log(`  Total subscriptions: ${stats[0]}`)
    console.log(`  Actives: ${stats[1]}`)
    console.log(`  Inactives: ${stats[2]}`)
  } finally {
    await prisma.$disconnect()
  }
}

checkSubscriptions().catch(console.error)
