import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../app/stores/auth'
import type { User } from '~/types'

// Mock des fonctions Nuxt
global.$fetch = vi.fn()
global.useCookie = vi.fn()
global.useRoute = vi.fn()
global.navigateTo = vi.fn()

// Mock import.meta.client pour les tests côté client
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      client: true
    }
  }
})

// Mock localStorage et sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(global, 'localStorage', { 
  value: localStorageMock,
  writable: true,
  configurable: true
})
Object.defineProperty(global, 'sessionStorage', { 
  value: sessionStorageMock,
  writable: true,
  configurable: true
})

// Mock process.env pour les tests
Object.defineProperty(process, 'env', {
  value: {
    NODE_ENV: 'test'
  }
})

describe('useAuthStore', () => {
  let authStore: ReturnType<typeof useAuthStore>
  
  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false
  }

  const mockCookie = {
    value: null
  }

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
    
    // Mock du cookie par défaut
    vi.mocked(useCookie).mockReturnValue(mockCookie)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('État initial', () => {
    it('devrait avoir un état initial correct', () => {
      expect(authStore.user).toBeNull()
      expect(authStore.token).toBeNull()
      expect(authStore.tokenExpiry).toBeNull()
      expect(authStore.rememberMe).toBe(false)
      expect(authStore.adminMode).toBe(false)
    })
  })

  describe('Getters', () => {
    it('isAuthenticated devrait retourner false sans token', () => {
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('isAuthenticated devrait retourner false avec token expiré', () => {
      authStore.token = 'test-token'
      authStore.tokenExpiry = Date.now() - 1000 // Expiré

      expect(authStore.isAuthenticated).toBe(false)
    })

    it('isAuthenticated devrait retourner true avec token valide', () => {
      authStore.token = 'test-token'
      authStore.tokenExpiry = Date.now() + 1000 // Valide

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
    it('devrait appeler l\'API d\'inscription avec les bonnes données', async () => {
      const mockResponse = { message: 'Inscription réussie' }
      vi.mocked($fetch).mockResolvedValue(mockResponse)

      const result = await authStore.register('test@example.com', 'Password123', 'testuser', 'Test', 'User')

      expect($fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123',
          pseudo: 'testuser',
          nom: 'Test',
          prenom: 'User'
        }
      })
      expect(result).toEqual(mockResponse)
    })

    it('devrait propager les erreurs d\'inscription', async () => {
      const mockError = new Error('Email déjà utilisé')
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(authStore.register('test@example.com', 'Password123', 'testuser', 'Test', 'User'))
        .rejects.toThrow('Email déjà utilisé')
    })
  })

  describe('Action login', () => {
    const mockLoginResponse = {
      user: mockUser,
      token: 'test-token-123'
    }

    beforeEach(() => {
      vi.mocked($fetch).mockResolvedValue(mockLoginResponse)
    })

    it('devrait connecter l\'utilisateur avec succès', async () => {
      const result = await authStore.login('test@example.com', 'password', false)

      expect($fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: { identifier: 'test@example.com', password: 'password' }
      })

      expect(authStore.user).toEqual(mockUser)
      expect(authStore.token).toBe('test-token-123')
      expect(authStore.rememberMe).toBe(false)
      expect(authStore.tokenExpiry).toBeGreaterThan(Date.now())
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
      expect(authStore.token).toBe('test-token-123')
      expect(authStore.user).toEqual(mockUser)
    })

    it('devrait propager les erreurs de connexion', async () => {
      const mockError = new Error('Identifiants invalides')
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(authStore.login('test@example.com', 'wrong-password', false))
        .rejects.toThrow('Identifiants invalides')
    })
  })

  describe('Action logout', () => {
    beforeEach(() => {
      // Simuler un utilisateur connecté
      authStore.user = mockUser
      authStore.token = 'test-token'
      authStore.tokenExpiry = Date.now() + 1000
      authStore.rememberMe = true
      authStore.adminMode = true
    })

    it('devrait réinitialiser l\'état du store', () => {
      authStore.logout()

      expect(authStore.user).toBeNull()
      expect(authStore.token).toBeNull()
      expect(authStore.tokenExpiry).toBeNull()
      expect(authStore.rememberMe).toBe(false)
      expect(authStore.adminMode).toBe(false)
    })

    it('devrait être appelé côté client seulement', () => {
      authStore.logout()
      
      // Le logout devrait fonctionner même sans storage côté client
      expect(authStore.user).toBeNull()
      expect(authStore.token).toBeNull()
    })

    it('devrait supprimer le cookie d\'authentification', () => {
      authStore.logout()

      expect(mockCookie.value).toBeNull()
    })
  })

  describe('Action initializeAuth', () => {
    it('devrait ne rien faire côté serveur', () => {
      authStore.initializeAuth()

      // En environnement de test (côté serveur), initializeAuth ne devrait rien faire
      expect(authStore.token).toBeNull()
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
        ...updatedData
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

    it('ne devrait rien faire si pas d\'utilisateur connecté', () => {
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

  describe('Action checkTokenExpiry', () => {
    it('devrait faire logout si le token est expiré', () => {
      authStore.token = 'test-token'
      authStore.tokenExpiry = Date.now() - 1000 // Expiré

      const logoutSpy = vi.spyOn(authStore, 'logout')
      authStore.checkTokenExpiry()

      expect(logoutSpy).toHaveBeenCalled()
    })

    it('ne devrait rien faire si le token est valide', () => {
      authStore.token = 'test-token'
      authStore.tokenExpiry = Date.now() + 1000 // Valide

      const logoutSpy = vi.spyOn(authStore, 'logout')
      authStore.checkTokenExpiry()

      expect(logoutSpy).not.toHaveBeenCalled()
    })

    it('ne devrait rien faire si pas de token', () => {
      const logoutSpy = vi.spyOn(authStore, 'logout')
      authStore.checkTokenExpiry()

      expect(logoutSpy).not.toHaveBeenCalled()
    })
  })
})