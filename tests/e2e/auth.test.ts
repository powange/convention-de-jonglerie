import { $fetch } from '@nuxt/test-utils/e2e'
import { describe, it, expect } from 'vitest'

// Tests E2E simplifiés qui utilisent directement les API
describe.skip('Authentication E2E', () => {
  describe('API Endpoints', () => {
    it('devrait rejeter une connexion avec des identifiants invalides', async () => {
      await expect(
        $fetch('/api/auth/login', {
          method: 'POST',
          body: {
            identifier: 'invalid@example.com',
            password: 'wrongpassword',
          },
        })
      ).rejects.toThrow()
    })

    it("devrait rejeter l'inscription avec un email invalide", async () => {
      await expect(
        $fetch('/api/auth/register', {
          method: 'POST',
          body: {
            email: 'invalid-email',
            password: 'Password123!',
            pseudo: 'testuser',
            nom: 'Test',
            prenom: 'User',
          },
        })
      ).rejects.toThrow()
    })

    it('devrait permettre de demander un reset de mot de passe', async () => {
      const response = await $fetch('/api/auth/request-password-reset', {
        method: 'POST',
        body: {
          email: 'test@example.com',
        },
      })

      expect(response.message).toContain('Si un compte existe')
    })
  })
})
