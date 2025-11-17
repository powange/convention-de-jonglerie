#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import md5 from 'md5'

config()

const prisma = new PrismaClient()

/**
 * Fonction de génération de hash d'email (copie locale pour éviter les problèmes d'imports avec tsx)
 * Normalise l'email et génère un hash MD5 pour Gravatar
 */
function getEmailHash(email: string): string {
  if (!email) return ''

  // Normaliser l'email (minuscules et supprimer les espaces)
  const normalizedEmail = email.trim().toLowerCase()

  // Créer le hash MD5 de l'email
  return md5(normalizedEmail) as string
}

/**
 * Script pour ajouter le hash d'email à tous les utilisateurs qui n'en ont pas
 */
async function main() {
  console.log('🔍 Recherche des utilisateurs sans emailHash...')

  // Récupérer tous les utilisateurs sans emailHash
  const usersWithoutHash = await prisma.user.findMany({
    where: {
      OR: [{ emailHash: null }, { emailHash: '' }],
    },
    select: {
      id: true,
      email: true,
    },
  })

  console.log(`📊 ${usersWithoutHash.length} utilisateur(s) trouvé(s) sans emailHash`)

  if (usersWithoutHash.length === 0) {
    console.log('✅ Tous les utilisateurs ont déjà un emailHash')
    return
  }

  console.log('⚙️  Mise à jour des utilisateurs...')

  let updatedCount = 0
  let errorCount = 0

  for (const user of usersWithoutHash) {
    try {
      const emailHash = getEmailHash(user.email)

      await prisma.user.update({
        where: { id: user.id },
        data: { emailHash },
      })

      updatedCount++
      console.log(`✅ User ${user.id} (${user.email}): emailHash ajouté`)
    } catch (error) {
      errorCount++
      console.error(`❌ Erreur pour user ${user.id} (${user.email}):`, error)
    }
  }

  console.log('\n📈 Résumé:')
  console.log(`   ✅ ${updatedCount} utilisateur(s) mis à jour avec succès`)
  if (errorCount > 0) {
    console.log(`   ❌ ${errorCount} erreur(s)`)
  }
  console.log('✨ Script terminé !')
}

main()
  .catch((e) => {
    console.error("❌ Erreur fatale lors de l'exécution du script:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
