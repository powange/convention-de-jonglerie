import { describe, it, expect, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)('Tests d\'intégration Auth avec DB', () => {
  
  beforeEach(async () => {
    // Le nettoyage est fait automatiquement par setup-db.ts
  })

  describe('Inscription', () => {
    it('devrait créer un nouvel utilisateur dans la DB', async () => {
      const userData = {
        email: 'test@example.com',
        password: await bcrypt.hash('Password123!', 10),
        pseudo: 'testuser',
        nom: 'Test',
        prenom: 'User',
        isEmailVerified: false,
        emailVerificationCode: '123456',
        verificationCodeExpiry: new Date(Date.now() + 3600000)
      }

      const user = await prismaTest.user.create({
        data: userData
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.pseudo).toBe('testuser')
      
      // Vérifier que l'utilisateur existe dans la DB
      const foundUser = await prismaTest.user.findUnique({
        where: { email: 'test@example.com' }
      })
      
      expect(foundUser).toBeDefined()
      expect(foundUser?.id).toBe(user.id)
    })

    it('devrait empêcher les doublons d\'email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: await bcrypt.hash('Password123!', 10),
        pseudo: 'user1',
        nom: 'Test',
        prenom: 'User'
      }

      // Créer le premier utilisateur
      await prismaTest.user.create({ data: userData })

      // Tenter de créer un second avec le même email
      await expect(
        prismaTest.user.create({
          data: { ...userData, pseudo: 'user2' }
        })
      ).rejects.toThrow()
    })
  })

  describe('Connexion', () => {
    it('devrait vérifier le mot de passe correctement', async () => {
      const plainPassword = 'SecurePass123!'
      const hashedPassword = await bcrypt.hash(plainPassword, 10)

      const user = await prismaTest.user.create({
        data: {
          email: 'login@example.com',
          password: hashedPassword,
          pseudo: 'loginuser',
          nom: 'Login',
          prenom: 'User',
          isEmailVerified: true
        }
      })

      // Trouver l'utilisateur
      const foundUser = await prismaTest.user.findUnique({
        where: { email: 'login@example.com' }
      })

      expect(foundUser).toBeDefined()
      
      // Vérifier le mot de passe
      const isValid = await bcrypt.compare(plainPassword, foundUser!.password)
      expect(isValid).toBe(true)

      // Vérifier avec un mauvais mot de passe
      const isInvalid = await bcrypt.compare('wrongpassword', foundUser!.password)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Reset de mot de passe', () => {
    it('devrait créer et utiliser un token de reset', async () => {
      // Créer un utilisateur
      const user = await prismaTest.user.create({
        data: {
          email: 'reset@example.com',
          password: await bcrypt.hash('OldPassword123!', 10),
          pseudo: 'resetuser',
          nom: 'Reset',
          prenom: 'User'
        }
      })

      // Créer un token de reset
      const resetToken = await prismaTest.passwordResetToken.create({
        data: {
          token: 'test-reset-token-123',
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000), // 1 heure
          used: false
        }
      })

      expect(resetToken.id).toBeDefined()

      // Vérifier que le token existe
      const foundToken = await prismaTest.passwordResetToken.findUnique({
        where: { token: 'test-reset-token-123' },
        include: { user: true }
      })

      expect(foundToken).toBeDefined()
      expect(foundToken?.user.email).toBe('reset@example.com')
      expect(foundToken?.used).toBe(false)

      // Marquer le token comme utilisé
      await prismaTest.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })

      const usedToken = await prismaTest.passwordResetToken.findUnique({
        where: { id: resetToken.id }
      })

      expect(usedToken?.used).toBe(true)
    })

    it('devrait nettoyer les tokens expirés', async () => {
      const user = await prismaTest.user.create({
        data: {
          email: 'cleanup@example.com',
          password: 'hash',
          pseudo: 'cleanupuser',
          nom: 'Clean',
          prenom: 'Up'
        }
      })

      // Créer des tokens expirés et valides
      await prismaTest.passwordResetToken.create({
        data: {
          token: 'expired-token',
          userId: user.id,
          expiresAt: new Date(Date.now() - 3600000), // Expiré
          used: false
        }
      })

      await prismaTest.passwordResetToken.create({
        data: {
          token: 'valid-token',
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000), // Valide
          used: false
        }
      })

      // Nettoyer les tokens expirés
      const deleted = await prismaTest.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      expect(deleted.count).toBe(1)

      // Vérifier qu'il ne reste que le token valide
      const remainingTokens = await prismaTest.passwordResetToken.findMany({
        where: { userId: user.id }
      })

      expect(remainingTokens).toHaveLength(1)
      expect(remainingTokens[0].token).toBe('valid-token')
    })
  })
})