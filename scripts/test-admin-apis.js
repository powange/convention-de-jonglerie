#!/usr/bin/env node

/**
 * Script de test pour vérifier que les APIs admin des notifications fonctionnent
 */

async function testAdminAPIs() {
  try {
    console.log('🔍 Test des APIs admin des notifications...')

    // Test de l'API stats
    console.log('\n📊 Test /api/admin/notifications/stats')
    try {
      const statsResponse = await fetch('http://localhost:3000/api/admin/notifications/stats', {
        headers: {
          Cookie: process.env.TEST_ADMIN_COOKIE || '',
        },
      })

      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        console.log('✅ Stats API fonctionne:', stats)
      } else {
        console.log('❌ Stats API erreur:', statsResponse.status, await statsResponse.text())
      }
    } catch (error) {
      console.log('❌ Erreur Stats API:', error.message)
    }

    // Test de l'API recent
    console.log('\n📝 Test /api/admin/notifications/recent')
    try {
      const recentResponse = await fetch('http://localhost:3000/api/admin/notifications/recent', {
        headers: {
          Cookie: process.env.TEST_ADMIN_COOKIE || '',
        },
      })

      if (recentResponse.ok) {
        const recent = await recentResponse.json()
        console.log(
          '✅ Recent API fonctionne, notifications trouvées:',
          recent.notifications?.length || 0
        )
      } else {
        console.log('❌ Recent API erreur:', recentResponse.status, await recentResponse.text())
      }
    } catch (error) {
      console.log('❌ Erreur Recent API:', error.message)
    }
  } catch (error) {
    console.error('❌ Erreur générale:', error)
  }
}

// Exécuter le test
if (require.main === module) {
  testAdminAPIs()
}

module.exports = testAdminAPIs
