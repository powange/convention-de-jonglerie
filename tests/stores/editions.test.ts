import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useAuthStore } from '../../app/stores/auth'
import { useEditionStore } from '../../app/stores/editions'

// Mock des fonctions Nuxt
global.$fetch = vi.fn() as any
global.useCookie = vi.fn()
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

describe('useEditionStore', () => {
  let editionStore: ReturnType<typeof useEditionStore>
  let authStore: ReturnType<typeof useAuthStore>

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
  }

  const mockEdition = {
    id: 1,
    name: 'Test Edition',
    startDate: '2024-06-01',
    endDate: '2024-06-03',
    location: 'Test City',
    country: 'France',
    maxParticipants: 100,
    registrationStartDate: '2024-01-01',
    registrationEndDate: '2024-05-30',
    price: 50,
    description: 'Test description',
    website: 'http://test.com',
    creatorId: 1,
    conventionId: 1,
    favoritedBy: [],
    collaborators: [],
    creator: mockUser,
    convention: {
      id: 1,
      name: 'Test Convention',
      authorId: 1,
      collaborators: [],
    },
  }

  const mockPaginatedResponse = {
    data: [mockEdition],
    pagination: {
      total: 1,
      page: 1,
      limit: 12,
      totalPages: 1,
    },
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    editionStore = useEditionStore()
    authStore = useAuthStore()

    // Reset tous les mocks
    vi.clearAllMocks()

    // Mock des valeurs par défaut
    authStore.user = mockUser
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('État initial', () => {
    it('devrait avoir un état initial correct', () => {
      expect(editionStore.editions).toEqual([])
      expect(editionStore.loading).toBe(false)
      expect(editionStore.error).toBeNull()
      expect(editionStore.pagination).toEqual({
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
      })
    })
  })

  describe('Getters', () => {
    it("getEditionById devrait retourner l'édition correspondante", () => {
      editionStore.editions = [mockEdition]

      const result = editionStore.getEditionById(1)
      expect(result).toEqual(mockEdition)
    })

    it('getEditionById devrait retourner undefined si édition non trouvée', () => {
      const result = editionStore.getEditionById(999)
      expect(result).toBeUndefined()
    })
  })

  describe('Action fetchEditions', () => {
    it('devrait récupérer les éditions avec succès', async () => {
      vi.mocked($fetch).mockResolvedValue(mockPaginatedResponse)

      await editionStore.fetchEditions()

      expect($fetch).toHaveBeenCalledWith('/api/editions', {
        params: {
          page: '1',
          limit: '12',
        },
      })
      expect(editionStore.editions).toEqual([mockEdition])
      expect(editionStore.pagination).toEqual(mockPaginatedResponse.pagination)
      expect(editionStore.loading).toBe(false)
      expect(editionStore.error).toBeNull()
    })

    it('devrait appliquer les filtres de recherche', async () => {
      vi.mocked($fetch).mockResolvedValue(mockPaginatedResponse)

      const filters = {
        page: 2,
        limit: 24,
        name: 'test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        countries: ['France', 'Belgium'],
        showPast: true,
        showCurrent: false,
        showFuture: true,
        hasFoodTrucks: true,
        hasKidsZone: false,
        acceptsPets: true,
      }

      await editionStore.fetchEditions(filters)

      expect($fetch).toHaveBeenCalledWith('/api/editions', {
        params: {
          page: '2',
          limit: '24',
          name: 'test',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          countries: JSON.stringify(['France', 'Belgium']),
          showPast: 'true',
          showCurrent: 'false',
          showFuture: 'true',
          hasFoodTrucks: 'true',
          acceptsPets: 'true',
        },
      })
    })

    it('devrait gérer les erreurs de récupération', async () => {
      const mockError = {
        message: 'Network error',
        data: { message: 'Failed to fetch' },
      }
      vi.mocked($fetch).mockRejectedValue(mockError)

      await editionStore.fetchEditions()

      expect(editionStore.error).toBe('Network error')
      expect(editionStore.loading).toBe(false)
      expect(editionStore.editions).toEqual([])
    })

    it("devrait définir l'état de chargement correctement", async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked($fetch).mockReturnValue(promise)

      const fetchPromise = editionStore.fetchEditions()
      expect(editionStore.loading).toBe(true)

      resolvePromise!(mockPaginatedResponse)
      await fetchPromise
      expect(editionStore.loading).toBe(false)
    })
  })

  describe('Action fetchEditionById', () => {
    it('devrait récupérer une édition par ID', async () => {
      const editionCopy = { ...mockEdition }
      vi.mocked($fetch).mockResolvedValue(editionCopy)

      const result = await editionStore.fetchEditionById(1)

      expect($fetch).toHaveBeenCalledWith('/api/editions/1')
      expect(result).toEqual(mockEdition)
      expect(editionStore.editions.length).toBe(1)
      expect(editionStore.editions[0]).toEqual(editionCopy)
    })

    it('devrait mettre à jour une édition existante', async () => {
      const updatedEdition = { ...mockEdition, name: 'Updated Edition' }
      editionStore.editions = [mockEdition]
      vi.mocked($fetch).mockResolvedValue(updatedEdition)

      await editionStore.fetchEditionById(1)

      expect(editionStore.editions[0]).toEqual(updatedEdition)
    })

    it('devrait propager les erreurs', async () => {
      const mockError = new Error('Edition not found')
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(editionStore.fetchEditionById(999)).rejects.toThrow('Edition not found')
      expect(editionStore.error).toBe('Edition not found')
    })
  })

  describe('Action addEdition', () => {
    const newEditionData = {
      name: 'New Edition',
      startDate: '2024-07-01',
      endDate: '2024-07-03',
      location: 'New City',
      country: 'Spain',
      maxParticipants: 200,
      registrationStartDate: '2024-03-01',
      registrationEndDate: '2024-06-30',
      price: 75,
      description: 'New description',
      website: 'http://new.com',
      conventionId: 1,
    }

    it('devrait ajouter une nouvelle édition', async () => {
      const newEdition = { ...mockEdition, ...newEditionData, id: 2 }
      const newEditionCopy = { ...newEdition }
      vi.mocked($fetch).mockResolvedValue(newEditionCopy)

      const result = await editionStore.addEdition(newEditionData)

      expect($fetch).toHaveBeenCalledWith('/api/editions', {
        method: 'POST',
        body: newEditionData,
      })
      expect(result).toEqual(newEditionCopy)
      expect(editionStore.editions.length).toBe(1)
      expect(editionStore.editions[0]).toEqual(newEditionCopy)
    })

    it("devrait propager les erreurs d'ajout", async () => {
      const mockError = {
        message: 'Validation error',
        data: { message: 'Invalid data' },
      }
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(editionStore.addEdition(newEditionData)).rejects.toEqual(mockError)
      expect(editionStore.error).toBe('Validation error')
    })
  })

  describe('Action updateEdition', () => {
    beforeEach(() => {
      editionStore.editions = [mockEdition]
    })

    it('devrait mettre à jour une édition existante', async () => {
      const updatedEdition = { ...mockEdition, name: 'Updated Edition' }
      vi.mocked($fetch).mockResolvedValue(updatedEdition)

      const result = await editionStore.updateEdition(1, updatedEdition)

      expect($fetch).toHaveBeenCalledWith('/api/editions/1', {
        method: 'PUT',
        body: updatedEdition,
      })
      expect(result).toEqual(updatedEdition)
      expect(editionStore.editions[0]).toEqual(updatedEdition)
    })

    it("devrait gérer l'édition non trouvée localement", async () => {
      const updatedEdition = { ...mockEdition, name: 'Updated Edition' }
      vi.mocked($fetch).mockResolvedValue(updatedEdition)

      await editionStore.updateEdition(999, updatedEdition)

      expect($fetch).toHaveBeenCalled()
      // L'édition ne devrait pas être ajoutée au store si elle n'existait pas
      expect(editionStore.editions.length).toBe(1)
    })

    it('devrait propager les erreurs de mise à jour', async () => {
      const mockError = {
        message: 'Permission denied',
        data: { message: 'Unauthorized' },
      }
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(editionStore.updateEdition(1, mockEdition)).rejects.toEqual(mockError)
      expect(editionStore.error).toBe('Permission denied')
    })
  })

  describe('Action deleteEdition', () => {
    beforeEach(() => {
      editionStore.editions = [mockEdition, { ...mockEdition, id: 2 }]
    })

    it('devrait supprimer une édition', async () => {
      vi.mocked($fetch).mockResolvedValue(undefined)

      await editionStore.deleteEdition(1)

      expect($fetch).toHaveBeenCalledWith('/api/editions/1', {
        method: 'DELETE',
      })
      expect(editionStore.editions).toHaveLength(1)
      expect(editionStore.editions[0].id).toBe(2)
    })

    it('devrait propager les erreurs de suppression', async () => {
      const mockError = {
        message: 'Permission denied',
        data: { message: 'Cannot delete' },
      }
      vi.mocked($fetch).mockRejectedValue(mockError)

      await expect(editionStore.deleteEdition(1)).rejects.toEqual(mockError)
      expect(editionStore.error).toBe('Permission denied')
      expect(editionStore.editions).toHaveLength(2) // Pas de suppression
    })
  })

  describe('Action toggleFavorite', () => {
    beforeEach(() => {
      editionStore.editions = [{ ...mockEdition, favoritedBy: [] }]
    })

    it('devrait ajouter aux favoris (optimistic update)', async () => {
      vi.mocked($fetch).mockResolvedValue({ success: true })

      await editionStore.toggleFavorite(1)

      expect($fetch).toHaveBeenCalledWith('/api/editions/1/favorite', {
        method: 'POST',
      })

      // Vérifier l'optimistic update
      const edition = editionStore.editions[0]
      expect(edition.favoritedBy).toHaveLength(1)
      expect(edition.favoritedBy[0].id).toBe(mockUser.id)
    })

    it('devrait retirer des favoris (optimistic update)', async () => {
      editionStore.editions[0].favoritedBy = [
        {
          id: mockUser.id,
          email: mockUser.email,
          pseudo: mockUser.pseudo,
        },
      ]
      vi.mocked($fetch).mockResolvedValue({ success: true })

      await editionStore.toggleFavorite(1)

      // Vérifier l'optimistic update
      const edition = editionStore.editions[0]
      expect(edition.favoritedBy).toHaveLength(0)
    })

    it("devrait annuler l'optimistic update en cas d'erreur", async () => {
      const mockError = { message: 'Network error' }
      vi.mocked($fetch).mockRejectedValue(mockError)

      // Commencer avec favori non ajouté
      expect(editionStore.editions[0].favoritedBy).toHaveLength(0)

      await expect(editionStore.toggleFavorite(1)).rejects.toEqual(mockError)

      // L'optimistic update devrait être annulé
      expect(editionStore.editions[0].favoritedBy).toHaveLength(0)
      expect(editionStore.error).toBe('Network error')
    })
  })

  describe('Actions collaborateurs', () => {
    const mockCollaborator = {
      id: 1,
      user: mockUser,
      role: 'MODERATOR',
      canEdit: true,
      canDelete: false,
      conventionId: 1,
    }

    describe('getCollaborators', () => {
      it('devrait récupérer les collaborateurs', async () => {
        vi.mocked($fetch).mockResolvedValue([mockCollaborator])

        const result = await editionStore.getCollaborators(1)

        expect($fetch).toHaveBeenCalledWith('/api/editions/1/collaborators')
        expect(result).toEqual([mockCollaborator])
      })

      it('devrait propager les erreurs', async () => {
        const mockError = { message: 'Unauthorized' }
        vi.mocked($fetch).mockRejectedValue(mockError)

        await expect(editionStore.getCollaborators(1)).rejects.toEqual(mockError)
        expect(editionStore.error).toBe('Unauthorized')
      })
    })

    describe('addCollaborator', () => {
      beforeEach(() => {
        editionStore.editions = [{ ...mockEdition, collaborators: [] }]
      })

      it('devrait ajouter un collaborateur', async () => {
        const collaboratorCopy = { ...mockCollaborator }
        vi.mocked($fetch).mockResolvedValue(collaboratorCopy)

        const result = await editionStore.addCollaborator(1, 'collab@test.com', true)

        expect($fetch).toHaveBeenCalledWith('/api/editions/1/collaborators', {
          method: 'POST',
          body: { userEmail: 'collab@test.com', canEdit: true },
        })
        expect(result).toEqual(collaboratorCopy)
        expect(editionStore.editions[0].collaborators!.length).toBe(1)
        expect(editionStore.editions[0].collaborators![0]).toEqual(collaboratorCopy)
      })
    })

    describe('removeCollaborator', () => {
      beforeEach(() => {
        editionStore.editions = [
          {
            ...mockEdition,
            collaborators: [mockCollaborator],
          },
        ]
      })

      it('devrait supprimer un collaborateur', async () => {
        vi.mocked($fetch).mockResolvedValue(undefined)

        await editionStore.removeCollaborator(1, 1)

        expect($fetch).toHaveBeenCalledWith('/api/editions/1/collaborators/1', {
          method: 'DELETE',
        })
        expect(editionStore.editions[0].collaborators).toHaveLength(0)
      })
    })
  })

  describe('Méthodes de permission', () => {
    const mockEditionWithConvention = {
      ...mockEdition,
      convention: {
        id: 1,
        name: 'Test Convention',
        authorId: 2,
        collaborators: [
          {
            id: 1,
            user: mockUser,
            role: 'MODERATOR',
            canEdit: true,
            canDelete: true,
            conventionId: 1,
          },
        ],
      },
    }

    describe('canEditEdition', () => {
      it("devrait autoriser l'admin global en mode admin", () => {
        authStore.user = { ...mockUser, isGlobalAdmin: true }
        authStore.adminMode = true

        const canEdit = editionStore.canEditEdition(mockEdition, 1)
        expect(canEdit).toBe(true)
      })

      it("devrait autoriser le créateur de l'édition", () => {
        const canEdit = editionStore.canEditEdition(mockEdition, 1)
        expect(canEdit).toBe(true)
      })

      it("devrait autoriser l'auteur de la convention", () => {
        const canEdit = editionStore.canEditEdition(mockEditionWithConvention, 2)
        expect(canEdit).toBe(true)
      })

      it('devrait autoriser les collaborateurs MODERATOR', () => {
        const canEdit = editionStore.canEditEdition(mockEditionWithConvention, 1)
        expect(canEdit).toBe(true)
      })

      it('devrait refuser les utilisateurs sans permission', () => {
        const canEdit = editionStore.canEditEdition(mockEdition, 999)
        expect(canEdit).toBe(false)
      })
    })

    describe('canDeleteEdition', () => {
      it("devrait autoriser l'admin global en mode admin", () => {
        authStore.user = { ...mockUser, isGlobalAdmin: true }
        authStore.adminMode = true

        const canDelete = editionStore.canDeleteEdition(mockEdition, 1)
        expect(canDelete).toBe(true)
      })

      it("devrait autoriser le créateur de l'édition", () => {
        const canDelete = editionStore.canDeleteEdition(mockEdition, 1)
        expect(canDelete).toBe(true)
      })

      it('devrait refuser les utilisateurs sans permission', () => {
        const canDelete = editionStore.canDeleteEdition(mockEdition, 999)
        expect(canDelete).toBe(false)
      })
    })
  })

  describe('Méthodes utilitaires', () => {
    describe('sortEditions', () => {
      it('devrait trier les éditions par date de début (croissant)', () => {
        const edition1 = { ...mockEdition, id: 1, startDate: '2024-06-03' }
        const edition2 = { ...mockEdition, id: 2, startDate: '2024-06-01' }
        const edition3 = { ...mockEdition, id: 3, startDate: '2024-06-02' }

        editionStore.editions = [edition1, edition2, edition3]
        editionStore.sortEditions()

        expect(editionStore.editions[0].id).toBe(2) // 2024-06-01
        expect(editionStore.editions[1].id).toBe(3) // 2024-06-02
        expect(editionStore.editions[2].id).toBe(1) // 2024-06-03
      })
    })

    describe('processEditions', () => {
      it('devrait appeler le tri des éditions', () => {
        const sortSpy = vi.spyOn(editionStore, 'sortEditions')
        editionStore.processEditions()
        expect(sortSpy).toHaveBeenCalled()
      })
    })
  })
})
