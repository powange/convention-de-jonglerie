import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useAuthStore } from '../../../app/stores/auth'

import type { User } from '../../../app/types'

// Mock des fonctions Nuxt
global.$fetch = vi.fn() as any
// plus de cookie JWT à gérer côté client
global.useRoute = vi.fn()
global.navigateTo = vi.fn()

// Mock import.meta.client pour les tests côté client
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      client: true,
    },
  },
})

// Mock localStorage et sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true,
})

// Mock process.env pour les tests
Object.defineProperty(process, 'env', {
  value: {
    NODE_ENV: 'test',
  },
})

describe('useAuthStore', () => {
  let authStore: ReturnType<typeof useAuthStore>

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // plus de cookie géré explicitement par le store

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()

    // Reset tous les mocks
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    sessionStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.setItem.mockImplementation(() => {})
    sessionStorageMock.removeItem.mockImplementation(() => {})

    // aucun cookie à mocker
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('État initial', () => {
    it('devrait avoir un état initial correct', () => {
      expect(authStore.user).toBeNull()
      expect(authStore.rememberMe).toBe(false)
      expect(authStore.adminMode).toBe(false)
    })
  })

  describe('Getters', () => {
    it('isAuthenticated devrait retourner false sans utilisateur', () => {
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('isAuthenticated devrait retourner true avec utilisateur défini', () => {
      authStore.user = { ...mockUser }
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('isGlobalAdmin devrait retourner false sans utilisateur', () => {
      expect(authStore.isGlobalAdmin).toBe(false)
    })

    it('isGlobalAdmin devrait retourner true pour un admin global', () => {
      authStore.user = { ...mockUser, isGlobalAdmin: true }

      expect(authStore.isGlobalAdmin).toBe(true)
    })

    it('isAdminModeActive devrait retourner false par défaut', () => {
      // S'assurer qu'il y a un utilisateur non-admin
      authStore.user = { ...mockUser, isGlobalAdmin: false }
      expect(authStore.isAdminModeActive).toBe(false)
    })

    it('isAdminModeActive devrait retourner true pour admin en mode admin', () => {
      authStore.user = { ...mockUser, isGlobalAdmin: true }
      authStore.adminMode = true

      expect(authStore.isAdminModeActive).toBe(true)
    })
  })

  describe('Action register', () => {
    it("devrait appeler l'API d'inscription avec les bonnes données", async () => {
      const mockResponse = { message: 'Inscription réussie' }
      vi.mocked($fetch).mockResolvedValue(mockResponse)

      const result = await authStore.register(
        'test@example.com',
        'Password123',
        'testuser',
        'Test',
        'User'
      )

      expect($fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123',
          pseudo: 'testuser',
          nom: 'Test',
          prenom: 'User',
        },
      })
      expect(result).toEqual(mockResponse)
    })

    it("devrait propager les erreurs d'inscription", async () => {
      const mockError = new Error('Email déjà utilisé')
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(
        authStore.register('test@example.com', 'Password123', 'testuser', 'Test', 'User')
      ).rejects.toThrow('Email déjà utilisé')
    })
  })

  describe('Action login', () => {
    const mockLoginResponse = {
      user: mockUser,
    }

    beforeEach(() => {
      vi.mocked($fetch).mockResolvedValue(mockLoginResponse)
    })

    it("devrait connecter l'utilisateur avec succès", async () => {
      const result = await authStore.login('test@example.com', 'password', false)

      expect($fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: { identifier: 'test@example.com', password: 'password', rememberMe: false },
      })

      expect(authStore.user).toEqual(mockUser)
      expect(authStore.rememberMe).toBe(false)
      expect(result).toEqual(mockLoginResponse)
    })

    it('devrait définir rememberMe à false sans option', async () => {
      await authStore.login('test@example.com', 'password', false)

      expect(authStore.rememberMe).toBe(false)
    })

    it('devrait définir rememberMe à true avec option', async () => {
      await authStore.login('test@example.com', 'password', true)

      expect(authStore.rememberMe).toBe(true)
    })

    it('devrait gérer les cookies en mode client', async () => {
      await authStore.login('test@example.com', 'password', false)

      // En environnement de test, les fonctions côté client ne sont pas appelées
      // On vérifie juste que l'état du store est correct
      expect(authStore.user).toEqual(mockUser)
    })

    it('devrait propager les erreurs de connexion', async () => {
      const mockError = new Error('Identifiants invalides')
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(authStore.login('test@example.com', 'wrong-password', false)).rejects.toThrow(
        'Identifiants invalides'
      )
    })
  })

  describe('Action logout', () => {
    beforeEach(() => {
      // Simuler un utilisateur connecté
      authStore.user = mockUser
      authStore.rememberMe = true
      authStore.adminMode = true
    })

    it("devrait réinitialiser l'état du store", async () => {
      await authStore.logout()

      expect(authStore.user).toBeNull()
      expect(authStore.rememberMe).toBe(false)
      expect(authStore.adminMode).toBe(false)
    })

    it('devrait être appelé côté client seulement', async () => {
      await authStore.logout()

      // Le logout devrait fonctionner même sans storage côté client
      expect(authStore.user).toBeNull()
    })

    it("devrait appeler l'API de logout", () => {
      authStore.logout()
      expect($fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    })
  })

  describe('Action initializeAuth', () => {
    it('devrait ne rien faire côté serveur (en test)', async () => {
      await authStore.initializeAuth()
      await Promise.resolve()
      expect(authStore.user).toBeNull()
    })
  })

  describe('Action updateUser', () => {
    beforeEach(() => {
      authStore.user = mockUser
      authStore.rememberMe = true
    })

    it('devrait mettre à jour les données utilisateur', () => {
      const updatedData = { pseudo: 'newpseudo', nom: 'NewName' }

      authStore.updateUser(updatedData)

      expect(authStore.user).toEqual({
        ...mockUser,
        ...updatedData,
      })
    })

    it('devrait fonctionner avec rememberMe true', () => {
      authStore.updateUser({ pseudo: 'newpseudo' })

      expect(authStore.user?.pseudo).toBe('newpseudo')
    })

    it('devrait fonctionner avec rememberMe false', () => {
      authStore.rememberMe = false
      authStore.updateUser({ pseudo: 'newpseudo' })

      expect(authStore.user?.pseudo).toBe('newpseudo')
    })

    it("ne devrait rien faire si pas d'utilisateur connecté", () => {
      authStore.user = null
      authStore.updateUser({ pseudo: 'newpseudo' })

      expect(authStore.user).toBeNull()
    })
  })

  describe('Actions mode admin', () => {
    beforeEach(() => {
      authStore.user = { ...mockUser, isGlobalAdmin: true }
      authStore.rememberMe = true
    })

    describe('enableAdminMode', () => {
      it('devrait activer le mode admin pour un admin global', () => {
        authStore.enableAdminMode()

        expect(authStore.adminMode).toBe(true)
      })

      it('ne devrait pas activer le mode admin pour un utilisateur normal', () => {
        authStore.user = { ...mockUser, isGlobalAdmin: false }

        authStore.enableAdminMode()

        expect(authStore.adminMode).toBe(false)
      })
    })

    describe('disableAdminMode', () => {
      beforeEach(() => {
        authStore.adminMode = true
      })

      it('devrait désactiver le mode admin', () => {
        authStore.disableAdminMode()

        expect(authStore.adminMode).toBe(false)
      })
    })
  })

  // Plus de checkTokenExpiry: la logique JWT a été retirée
})
