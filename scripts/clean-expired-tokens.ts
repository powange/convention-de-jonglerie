import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanExpiredTokens() {
  console.log('🧹 Nettoyage des tokens expirés...')
  
  try {
    // Nettoyer les tokens de réinitialisation de mot de passe expirés
    const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: new Date()
            }
          },
          {
            used: true
          }
        ]
      }
    })
    
    console.log(`✅ ${deletedPasswordTokens.count} token(s) de réinitialisation de mot de passe supprimé(s)`)
    
    // Nettoyer les codes de vérification email expirés (si applicable)
    const expiredVerificationCodes = await prisma.user.updateMany({
      where: {
        AND: [
          {
            verificationCodeExpiry: {
              lt: new Date()
            }
          },
          {
            emailVerificationCode: {
              not: null
            }
          },
          {
            isEmailVerified: false
          }
        ]
      },
      data: {
        emailVerificationCode: null,
        verificationCodeExpiry: null
      }
    })
    
    console.log(`✅ ${expiredVerificationCodes.count} code(s) de vérification email expiré(s) nettoyé(s)`)
    
    // Afficher un résumé
    console.log('\n📊 Résumé du nettoyage:')
    console.log(`- Tokens de réinitialisation: ${deletedPasswordTokens.count}`)
    console.log(`- Codes de vérification: ${expiredVerificationCodes.count}`)
    console.log(`- Total: ${deletedPasswordTokens.count + expiredVerificationCodes.count} entrée(s) nettoyée(s)`)
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script
cleanExpiredTokens()
  .then(() => {
    console.log('\n✨ Nettoyage terminé avec succès!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })