#!/usr/bin/env node

/**
 * Script de test pour le système de notifications SSE
 * Usage: node scripts/test-notifications.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

console.log('🧪 Test du système de notifications SSE')
console.log('======================================')

console.log('\n📋 Instructions de test :')
console.log('\n1. **Connexion SSE** :')
console.log('   - Ouvrez votre navigateur sur:', `${BASE_URL}`)
console.log('   - Connectez-vous avec un compte utilisateur')
console.log('   - Ouvrez les outils développeur (F12)')
console.log("   - Allez dans l'onglet Console")
console.log('   - Cherchez les messages "[SSE Client]"')

console.log('\n2. **Test de réception** :')
console.log('   - Gardez la page ouverte')
console.log('   - Dans un autre onglet, connectez-vous en admin')
console.log("   - Utilisez l'API de test :", `${BASE_URL}/api/admin/notifications/test`)

console.log('\n3. **Vérifications attendues** :')
console.log('   ✅ Message "Connexion établie" dans les logs')
console.log('   ✅ Toast de notification "Connexion établie"')
console.log('   ✅ Indicateur vert "Temps réel" dans le centre de notifications')
console.log('   ✅ Réception des notifications de test en temps réel')

console.log('\n4. **Test de déconnexion/reconnexion** :')
console.log('   - Désactivez votre réseau pendant 10 secondes')
console.log('   - Réactivez le réseau')
console.log('   - Vérifiez la reconnexion automatique')

console.log("\n🔧 Commandes curl pour tester l'API :")
console.log('\n# Tester la connexion SSE (doit retourner 401 sans auth)')
console.log(`curl -H "Accept: text/event-stream" ${BASE_URL}/api/notifications/stream`)

console.log('\n# Voir les statistiques des connexions (avec session admin)')
console.log('# Remplacez COOKIE_SESSION par votre cookie de session')
console.log(
  `curl -H "Cookie: nuxt-session=COOKIE_SESSION" ${BASE_URL}/api/admin/notifications/test \\`
)
console.log('  -X POST -H "Content-Type: application/json" \\')
console.log('  -d \'{"type":"welcome"}\'')

console.log('\n📊 Surveillance en temps réel :')
console.log('# Dans la console de votre navigateur, surveillez :')
console.log('console.log("[SSE Client]")  // Messages de connexion')
console.log('console.log("[Store]")       // Messages du store Pinia')

console.log('\n🐛 En cas de problème :')
console.log('- Vérifiez que le serveur dev est démarré')
console.log('- Vérifiez votre authentification')
console.log('- Consultez les logs serveur pour "[SSE]"')
console.log('- Vérifiez le Network tab pour les requêtes SSE')

console.log('\n✨ Test terminé. Bonne chance !')
