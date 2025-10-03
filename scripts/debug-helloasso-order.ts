/**
 * Script pour déboguer la structure des commandes HelloAsso
 */

import 'dotenv/config'

const HELLOASSO_API_URL = process.env.HELLOASSO_API_URL || 'https://api.helloasso.com'

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('   🔍 DEBUG COMMANDES HELLOASSO')
  console.log('═══════════════════════════════════════════════════════\n')

  // Utiliser les vrais identifiants de production
  const clientId = '8fc38a5a7454418da38d4df2398be4b8'
  const clientSecret = 'VOTRE_SECRET' // À remplacer temporairement
  const organizationSlug = 'fire-from-mars'
  const formType = 'Event'
  const formSlug = 'jongle-en-zik-2025'

  if (!clientSecret || clientSecret === 'VOTRE_SECRET') {
    console.error('❌ Veuillez mettre le client secret dans le script\n')
    process.exit(1)
  }

  try {
    // 1. Obtenir un token
    const tokenResponse = await fetch(`${HELLOASSO_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const { access_token } = await tokenResponse.json()

    // 2. Récupérer les commandes
    const ordersUrl = `${HELLOASSO_API_URL}/v5/organizations/${organizationSlug}/forms/${formType}/${formSlug}/orders?pageIndex=1&pageSize=1&withDetails=true`
    const ordersResponse = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const ordersData = await ordersResponse.json()

    if (ordersData.data && ordersData.data.length > 0) {
      const firstOrder = ordersData.data[0]
      console.log('📦 Structure de la première commande:\n')
      console.log(JSON.stringify(firstOrder, null, 2))

      if (firstOrder.items && firstOrder.items.length > 0) {
        console.log('\n\n📋 Structure du premier item:\n')
        console.log(JSON.stringify(firstOrder.items[0], null, 2))

        console.log('\n\n🔍 Analyse des champs:\n')
        console.log('   item.id:', firstOrder.items[0].id)
        console.log('   item.name:', firstOrder.items[0].name)
        console.log('   item.priceCategory:', firstOrder.items[0].priceCategory)
        console.log('   item.type:', firstOrder.items[0].type)
        console.log('   item.state:', firstOrder.items[0].state)
        console.log('   item.amount:', firstOrder.items[0].amount)
      }
    } else {
      console.log('⚠️  Aucune commande trouvée')
    }

    console.log('\n═══════════════════════════════════════════════════════\n')
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message)
    console.log('\n═══════════════════════════════════════════════════════\n')
    process.exit(1)
  }
}

main()
