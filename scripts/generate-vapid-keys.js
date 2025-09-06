#!/usr/bin/env node
/**
 * Génération des clés VAPID pour les notifications push
 * 
 * Usage:
 *   node scripts/generate-vapid-keys.js
 * 
 * Les clés générées doivent être ajoutées au fichier .env :
 *   NUXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:votre-email@domaine.com
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

import webpush from 'web-push'

console.log('🔑 Génération des clés VAPID pour les notifications push...\n')

try {
  // Générer les clés VAPID
  const vapidKeys = webpush.generateVAPIDKeys()
  
  console.log('✅ Clés VAPID générées avec succès !')
  console.log('\n📋 Ajoutez ces variables à votre fichier .env :\n')
  
  console.log(`NUXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
  console.log(`VAPID_SUBJECT=mailto:admin@convention-jonglerie.fr`)
  
  // Tenter de mettre à jour le fichier .env automatiquement
  const envPath = join(process.cwd(), '.env')
  
  if (existsSync(envPath)) {
    try {
      let envContent = readFileSync(envPath, 'utf-8')
      let updated = false
      
      // Ajouter ou mettre à jour les clés
      const updates = [
        { key: 'NUXT_PUBLIC_VAPID_PUBLIC_KEY', value: vapidKeys.publicKey },
        { key: 'VAPID_PRIVATE_KEY', value: vapidKeys.privateKey },
        { key: 'VAPID_SUBJECT', value: 'mailto:admin@convention-jonglerie.fr' },
      ]
      
      updates.forEach(({ key, value }) => {
        const regex = new RegExp(`^${key}=.*$`, 'm')
        const line = `${key}=${value}`
        
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, line)
          updated = true
        } else {
          envContent += `\n# Clés VAPID pour notifications push\n${line}\n`
          updated = true
        }
      })
      
      if (updated) {
        writeFileSync(envPath, envContent)
        console.log('\n✅ Fichier .env mis à jour automatiquement !')
      }
      
    } catch (error) {
      console.log('\n⚠️  Impossible de mettre à jour automatiquement le fichier .env')
      console.log('Veuillez ajouter manuellement les variables ci-dessus.')
    }
  } else {
    console.log('\n⚠️  Fichier .env non trouvé')
    console.log('Veuillez créer un fichier .env et ajouter les variables ci-dessus.')
  }
  
  console.log('\n📝 Instructions supplémentaires :')
  console.log('1. Redémarrez votre serveur de développement après avoir ajouté les variables')
  console.log('2. Testez les notifications dans /notifications après vous être connecté')
  console.log('3. Les notifications push nécessitent HTTPS en production')
  
  console.log('\n🔒 Sécurité :')
  console.log('- La clé privée ne doit JAMAIS être exposée côté client')
  console.log('- La clé publique peut être utilisée côté client')
  console.log('- Changez l\'email VAPID_SUBJECT par votre adresse de contact')
  
} catch (error) {
  console.error('❌ Erreur lors de la génération des clés VAPID:', error)
  process.exit(1)
}