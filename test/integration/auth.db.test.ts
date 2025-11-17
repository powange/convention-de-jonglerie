import bcrypt from 'bcryptjs'
import { describe, it, expect } from 'vitest'

import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)("Tests d'intégration Auth avec DB", () => {
  // Le nettoyage est géré globalement par setup-db.ts

  describe('Inscription', () => {
    it('devrait créer un nouvel utilisateur dans la DB', async () => {
      const timestamp = Date.now()
      const email = `test-${timestamp}@example.com`
      const userData = {
        email,
        emailHash: getEmailHash(email),
        password: await bcrypt.hash('Password123!', 10),
        pseudo: `testuser-${timestamp}`,
        nom: 'Test',
        prenom: 'User',
        isEmailVerified: false,
        emailVerificationCode: '123456',
        verificationCodeExpiry: new Date(Date.now() + 3600000),
      }

      const user = await prismaTest.user.create({
        data: userData,
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe(`test-${timestamp}@example.com`)
      expect(user.pseudo).toBe(`testuser-${timestamp}`)

      // Vérifier que l'utilisateur existe dans la DB
      const foundUser = await prismaTest.user.findUnique({
        where: { email: `test-${timestamp}@example.com` },
      })

      expect(foundUser).toBeDefined()
      expect(foundUser?.id).toBe(user.id)
    })

    it("devrait empêcher les doublons d'email", async () => {
      const timestamp = Date.now()
      const email = `duplicate-${timestamp}@example.com`
      const userData = {
        email,
        emailHash: getEmailHash(email),
        password: await bcrypt.hash('Password123!', 10),
        pseudo: `user1-${timestamp}`,
        nom: 'Test',
        prenom: 'User',
      }

      // Utiliser une transaction explicite pour s'assurer que tout est dans le même contexte
      await expect(
        prismaTest.$transaction(async (tx) => {
          // Créer le premier utilisateur
          await tx.user.create({ data: userData })

          // Tenter de créer un second avec le même email dans la même transaction
          await tx.user.create({
            data: { ...userData, pseudo: `user2-${timestamp}` },
          })
        })
      ).rejects.toThrow(/Unique constraint failed/)
    })
  })

  describe('Connexion', () => {
    it('devrait vérifier le mot de passe correctement', async () => {
      const plainPassword = 'SecurePass123!'
      const hashedPassword = await bcrypt.hash(plainPassword, 10)
      const uniqueEmail = `login-${Date.now()}@example.com`

      await prismaTest.user.create({
        data: {
          email: uniqueEmail,
          emailHash: getEmailHash(uniqueEmail),
          password: hashedPassword,
          pseudo: `loginuser-${Date.now()}`,
          nom: 'Login',
          prenom: 'User',
          isEmailVerified: true,
        },
      })

      // Trouver l'utilisateur
      const foundUser = await prismaTest.user.findUnique({
        where: { email: uniqueEmail },
      })

      expect(foundUser).toBeDefined()
      expect(foundUser).not.toBeNull()

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
      const timestamp = Date.now()
      // Créer un utilisateur
      const email = `reset-${timestamp}@example.com`
      const user = await prismaTest.user.create({
        data: {
          email,
          emailHash: getEmailHash(email),
          password: await bcrypt.hash('OldPassword123!', 10),
          pseudo: `resetuser-${timestamp}`,
          nom: 'Reset',
          prenom: 'User',
        },
      })

      // Créer un token de reset
      const resetToken = await prismaTest.passwordResetToken.create({
        data: {
          token: `test-reset-token-${timestamp}`,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000), // 1 heure
          used: false,
        },
      })

      expect(resetToken.id).toBeDefined()

      // Vérifier que le token existe
      const foundToken = await prismaTest.passwordResetToken.findUnique({
        where: { token: `test-reset-token-${timestamp}` },
        include: { user: true },
      })

      expect(foundToken).toBeDefined()
      expect(foundToken?.user.email).toBe(`reset-${timestamp}@example.com`)
      expect(foundToken?.used).toBe(false)

      // Marquer le token comme utilisé
      await prismaTest.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      })

      const usedToken = await prismaTest.passwordResetToken.findUnique({
        where: { id: resetToken.id },
      })

      expect(usedToken?.used).toBe(true)
    })

    it('devrait nettoyer les tokens expirés', async () => {
      const timestamp = Date.now()
      const email = `cleanup-${timestamp}@example.com`
      const user = await prismaTest.user.create({
        data: {
          email,
          emailHash: getEmailHash(email),
          password: 'hash',
          pseudo: `cleanupuser-${timestamp}`,
          nom: 'Clean',
          prenom: 'Up',
        },
      })

      const now = new Date()
      const expiredDate = new Date(now.getTime() - 3600000) // 1 heure dans le passé
      const validDate = new Date(now.getTime() + 3600000) // 1 heure dans le futur

      // Créer des tokens expirés et valides
      await prismaTest.passwordResetToken.create({
        data: {
          token: 'expired-token',
          userId: user.id,
          expiresAt: expiredDate,
          used: false,
        },
      })

      await prismaTest.passwordResetToken.create({
        data: {
          token: 'valid-token',
          userId: user.id,
          expiresAt: validDate,
          used: false,
        },
      })

      // Nettoyer les tokens expirés (utiliser une date fixe pour être sûr)
      const deleted = await prismaTest.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      expect(deleted.count).toBe(1)

      // Vérifier qu'il ne reste que le token valide
      const remainingTokens = await prismaTest.passwordResetToken.findMany({
        where: { userId: user.id },
      })

      expect(remainingTokens).toHaveLength(1)
      expect(remainingTokens[0].token).toBe('valid-token')
    })
  })
})
