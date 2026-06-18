import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { useImpersonationStore } from '../../../app/stores/impersonation'

describe('useImpersonationStore', () => {
  let store: ReturnType<typeof useImpersonationStore>

  const originalUser = {
    id: 1,
    email: 'admin@example.com',
    pseudo: 'admin',
    nom: 'Admin',
    prenom: 'Super',
    // Champ supplémentaire pour vérifier qu'il n'est pas conservé
    isGlobalAdmin: true,
  }

  const targetUser = {
    id: 42,
    email: 'cible@example.com',
    pseudo: 'cible',
    nom: 'Cible',
    prenom: 'Utilisateur',
    isGlobalAdmin: false,
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useImpersonationStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('État initial', () => {
    it('devrait avoir un état initial correct', () => {
      expect(store.active).toBe(false)
      expect(store.originalUser).toBeNull()
      expect(store.targetUser).toBeNull()
      expect(store.startedAt).toBeNull()
    })
  })

  describe('Getters', () => {
    it('isActive devrait retourner false par défaut', () => {
      expect(store.isActive).toBe(false)
    })

    it('isActive devrait refléter active', () => {
      store.active = true
      expect(store.isActive).toBe(true)
    })

    it('originalUserInfo devrait retourner null par défaut', () => {
      expect(store.originalUserInfo).toBeNull()
    })

    it("originalUserInfo devrait retourner l'utilisateur original", () => {
      store.startImpersonation(originalUser, targetUser)
      expect(store.originalUserInfo).toEqual({
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        nom: 'Admin',
        prenom: 'Super',
      })
    })

    it('targetUserInfo devrait retourner null par défaut', () => {
      expect(store.targetUserInfo).toBeNull()
    })

    it("targetUserInfo devrait retourner l'utilisateur cible", () => {
      store.startImpersonation(originalUser, targetUser)
      expect(store.targetUserInfo).toEqual({
        id: 42,
        email: 'cible@example.com',
        pseudo: 'cible',
        nom: 'Cible',
        prenom: 'Utilisateur',
      })
    })

    it("displayInfo devrait retourner null si l'impersonation n'est pas active", () => {
      expect(store.displayInfo).toBeNull()
    })

    it('displayInfo devrait retourner null si originalUser est manquant', () => {
      store.active = true
      store.targetUser = { ...targetUser }
      store.originalUser = null
      expect(store.displayInfo).toBeNull()
    })

    it('displayInfo devrait retourner null si targetUser est manquant', () => {
      store.active = true
      store.originalUser = { ...originalUser }
      store.targetUser = null
      expect(store.displayInfo).toBeNull()
    })

    it("displayInfo devrait retourner les informations d'affichage quand actif", () => {
      store.startImpersonation(originalUser, targetUser)

      const info = store.displayInfo
      expect(info).not.toBeNull()
      expect(info?.impersonatingUser).toEqual(store.targetUser)
      expect(info?.originalUser).toEqual(store.originalUser)
      expect(info?.startedAt).toBe(store.startedAt)
    })
  })

  describe('Action startImpersonation', () => {
    it("devrait activer l'impersonation et stocker les deux utilisateurs", () => {
      store.startImpersonation(originalUser, targetUser)

      expect(store.active).toBe(true)
      expect(store.originalUser).toEqual({
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        nom: 'Admin',
        prenom: 'Super',
      })
      expect(store.targetUser).toEqual({
        id: 42,
        email: 'cible@example.com',
        pseudo: 'cible',
        nom: 'Cible',
        prenom: 'Utilisateur',
      })
      expect(store.startedAt).not.toBeNull()
    })

    it('ne devrait conserver que les champs attendus (pas de champs supplémentaires)', () => {
      store.startImpersonation(originalUser, targetUser)

      expect(store.originalUser).not.toHaveProperty('isGlobalAdmin')
      expect(store.targetUser).not.toHaveProperty('isGlobalAdmin')
    })

    it('devrait définir startedAt à la date courante (ISO)', () => {
      const fixedDate = new Date('2026-01-15T10:30:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(fixedDate)

      store.startImpersonation(originalUser, targetUser)

      expect(store.startedAt).toBe('2026-01-15T10:30:00.000Z')

      vi.useRealTimers()
    })
  })

  describe('Action stopImpersonation', () => {
    it("devrait réinitialiser tout l'état", () => {
      store.startImpersonation(originalUser, targetUser)
      expect(store.active).toBe(true)

      store.stopImpersonation()

      expect(store.active).toBe(false)
      expect(store.originalUser).toBeNull()
      expect(store.targetUser).toBeNull()
      expect(store.startedAt).toBeNull()
    })

    it('devrait être idempotent sur un état déjà vide', () => {
      store.stopImpersonation()

      expect(store.active).toBe(false)
      expect(store.originalUser).toBeNull()
      expect(store.targetUser).toBeNull()
      expect(store.startedAt).toBeNull()
    })
  })

  describe('Action initFromSession', () => {
    const sessionData = {
      user: {
        id: 42,
        email: 'cible@example.com',
        pseudo: 'cible',
        nom: 'Cible',
        prenom: 'Utilisateur',
      },
      impersonation: {
        active: true,
        originalUserId: 1,
        originalUserEmail: 'admin@example.com',
        originalUserPseudo: 'admin',
        originalUserNom: 'Admin',
        originalUserPrenom: 'Super',
        startedAt: '2026-01-15T10:30:00.000Z',
      },
    }

    it("devrait initialiser l'état depuis une session active", () => {
      store.initFromSession(sessionData)

      expect(store.active).toBe(true)
      expect(store.originalUser).toEqual({
        id: 1,
        email: 'admin@example.com',
        pseudo: 'admin',
        nom: 'Admin',
        prenom: 'Super',
      })
      expect(store.targetUser).toEqual({
        id: 42,
        email: 'cible@example.com',
        pseudo: 'cible',
        nom: 'Cible',
        prenom: 'Utilisateur',
      })
      expect(store.startedAt).toBe('2026-01-15T10:30:00.000Z')
    })

    it("devrait arrêter l'impersonation si la session n'est pas active", () => {
      // Mettre un état actif au préalable
      store.startImpersonation(originalUser, targetUser)

      store.initFromSession({
        user: sessionData.user,
        impersonation: { active: false },
      })

      expect(store.active).toBe(false)
      expect(store.originalUser).toBeNull()
      expect(store.targetUser).toBeNull()
      expect(store.startedAt).toBeNull()
    })

    it("devrait arrêter l'impersonation si sessionData est null", () => {
      store.startImpersonation(originalUser, targetUser)

      store.initFromSession(null)

      expect(store.active).toBe(false)
      expect(store.originalUser).toBeNull()
      expect(store.targetUser).toBeNull()
      expect(store.startedAt).toBeNull()
    })

    it("devrait arrêter l'impersonation si la clé impersonation est absente", () => {
      store.startImpersonation(originalUser, targetUser)

      store.initFromSession({ user: sessionData.user })

      expect(store.active).toBe(false)
    })
  })
})
