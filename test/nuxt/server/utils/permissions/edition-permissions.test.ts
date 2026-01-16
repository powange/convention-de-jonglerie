import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  canEditEdition,
  canDeleteEdition,
  canManageEditionStatus,
  canViewEdition,
  canManageArtists,
  canManageMeals,
  canManageTicketing,
  canManageEditionOrganizers,
  type EditionWithPermissions,
} from '../../../../../server/utils/permissions/edition-permissions'

import type { UserForPermissions } from '../../../../../server/utils/permissions/types'

describe('edition-permissions', () => {
  // Utilitaire pour créer une édition de base
  const createMockEdition = (
    overrides: Partial<EditionWithPermissions> = {}
  ): EditionWithPermissions => ({
    id: 1,
    conventionId: 10,
    creatorId: 100,
    name: 'Test Edition',
    slug: 'test-edition',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    description: 'Description',
    descriptionShort: null,
    editionNumber: 1,
    bannerUrl: null,
    logoUrl: null,
    website: null,
    city: 'Paris',
    country: 'FR',
    address: null,
    latitude: null,
    longitude: null,
    registrationEmail: null,
    carpoolingEnabled: false,
    volunteeringEnabled: false,
    postsEnabled: false,
    lostFoundEnabled: false,
    workshopsEnabled: false,
    showsEnabled: false,
    scheduleEnabled: false,
    mapsEnabled: false,
    ticketingEnabled: false,
    mealsEnabled: false,
    attendeesPublic: false,
    lodgingEnabled: false,
    artistsEnabled: false,
    faqEnabled: false,
    externalTicketUrl: null,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    convention: {
      id: 10,
      authorId: 200,
      name: 'Test Convention',
      slug: 'test-convention',
      description: 'Description',
      createdAt: new Date(),
      updatedAt: new Date(),
      organizers: [],
    },
    organizerPermissions: [],
    ...overrides,
  })

  // Utilitaire pour créer un utilisateur de base
  const createMockUser = (overrides: Partial<UserForPermissions> = {}): UserForPermissions => ({
    id: 999,
    email: 'user@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canEditEdition', () => {
    it("devrait autoriser le créateur de l'édition", () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it("devrait autoriser l'auteur de la convention", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          authorId: 42,
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un admin global', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999, isGlobalAdmin: true })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canEditAllEditions', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: true,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canEditConvention', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: true,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it("devrait autoriser avec permission d'édition spécifique", () => {
      const edition = createMockEdition({
        organizerPermissions: [
          {
            id: 'perm-1',
            editionId: 1,
            organizerId: 1,
            canEdit: true,
            canDelete: false,
            canManageOrganizers: false,
            canManageArtists: false,
            canManageMeals: false,
            canManageTicketing: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            organizer: { userId: 42 },
          },
        ],
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canEditEdition(edition, user)).toBe(false)
    })

    it("devrait refuser un organisateur sans droits d'édition", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(false)
    })
  })

  describe('canDeleteEdition', () => {
    it("devrait autoriser le créateur de l'édition", () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it("devrait autoriser l'auteur de la convention", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          authorId: 42,
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un admin global', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999, isGlobalAdmin: true })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canDeleteAllEditions', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: true,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canDeleteConvention', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: true,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser avec permission de suppression spécifique', () => {
      const edition = createMockEdition({
        organizerPermissions: [
          {
            id: 'perm-1',
            editionId: 1,
            organizerId: 1,
            canEdit: false,
            canDelete: true,
            canManageOrganizers: false,
            canManageArtists: false,
            canManageMeals: false,
            canManageTicketing: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            organizer: { userId: 42 },
          },
        ],
      })
      const user = createMockUser({ id: 42 })

      expect(canDeleteEdition(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canDeleteEdition(edition, user)).toBe(false)
    })
  })

  describe('canViewEdition', () => {
    it('devrait autoriser le créateur', () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canViewEdition(edition, user)).toBe(true)
    })

    it("devrait autoriser l'auteur de la convention", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          authorId: 42,
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canViewEdition(edition, user)).toBe(true)
    })

    it('devrait autoriser un admin global', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999, isGlobalAdmin: true })

      expect(canViewEdition(edition, user)).toBe(true)
    })

    it("devrait autoriser n'importe quel organisateur (même sans droits spécifiques)", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canViewEdition(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur non-organisateur', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canViewEdition(edition, user)).toBe(false)
    })
  })

  describe('canManageEditionStatus', () => {
    it('devrait autoriser le créateur', () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canManageEditionStatus(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canManageOrganizers', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: true,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canManageEditionStatus(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canManageEditionStatus(edition, user)).toBe(false)
    })
  })

  describe('canManageArtists', () => {
    it('devrait autoriser le créateur', () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canManageArtists(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canManageArtists', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: true,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canManageArtists(edition, user)).toBe(true)
    })

    it("devrait autoriser avec permission spécifique d'édition", () => {
      const edition = createMockEdition({
        organizerPermissions: [
          {
            id: 'perm-1',
            editionId: 1,
            organizerId: 1,
            canEdit: false,
            canDelete: false,
            canManageOrganizers: false,
            canManageArtists: true,
            canManageMeals: false,
            canManageTicketing: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            organizer: { userId: 42 },
          },
        ],
      })
      const user = createMockUser({ id: 42 })

      expect(canManageArtists(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canManageArtists(edition, user)).toBe(false)
    })
  })

  describe('canManageMeals', () => {
    it('devrait autoriser un organisateur avec canManageMeals', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: true,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canManageMeals(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canManageMeals(edition, user)).toBe(false)
    })
  })

  describe('canManageTicketing', () => {
    it('devrait autoriser un organisateur avec canManageTicketing', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canManageTicketing(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canManageTicketing(edition, user)).toBe(false)
    })
  })

  describe('canManageEditionOrganizers', () => {
    it('devrait autoriser le créateur', () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })

      expect(canManageEditionOrganizers(edition, user)).toBe(true)
    })

    it('devrait autoriser un organisateur avec canManageOrganizers', () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [
            {
              id: 1,
              conventionId: 10,
              userId: 42,
              canEditAllEditions: false,
              canEditConvention: false,
              canDeleteAllEditions: false,
              canDeleteConvention: false,
              canManageOrganizers: true,
              canManageArtists: false,
              canManageMeals: false,
              canManageTicketing: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      })
      const user = createMockUser({ id: 42 })

      expect(canManageEditionOrganizers(edition, user)).toBe(true)
    })

    it('devrait refuser un utilisateur sans droits', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 9999 })

      expect(canManageEditionOrganizers(edition, user)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it("devrait gérer les tableaux vides d'organisateurs", () => {
      const edition = createMockEdition({
        convention: {
          ...createMockEdition().convention,
          organizers: [],
        },
        organizerPermissions: [],
      })
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(false)
      expect(canDeleteEdition(edition, user)).toBe(false)
      expect(canViewEdition(edition, user)).toBe(false)
    })

    it('devrait gérer undefined pour organizers', () => {
      const edition = createMockEdition()
      // @ts-expect-error - Testing undefined case
      edition.convention.organizers = undefined
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(false)
    })

    it('devrait gérer undefined pour organizerPermissions', () => {
      const edition = createMockEdition()
      edition.organizerPermissions = undefined
      const user = createMockUser({ id: 42 })

      expect(canEditEdition(edition, user)).toBe(false)
    })

    it('devrait gérer isGlobalAdmin undefined', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 42 })
      // @ts-expect-error - Testing undefined case
      user.isGlobalAdmin = undefined

      expect(canEditEdition(edition, user)).toBe(false)
    })
  })
})
