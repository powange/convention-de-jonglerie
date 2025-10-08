import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAvatar } from '../../../app/utils/avatar'

// Mock useGravatar
const mockGetGravatarAvatar = vi.fn()
vi.mock('../../app/utils/gravatar', () => ({
  useGravatar: () => ({
    getUserAvatar: mockGetGravatarAvatar,
  }),
}))

// Mock useImageUrl (Nuxt function)
const mockGetImageUrl = vi.fn()
global.useImageUrl = vi.fn(() => ({
  getImageUrl: mockGetImageUrl,
}))

// Mock Date.now pour des tests prévisibles
const originalDateNow = Date.now
const mockDateNow = vi.fn(() => 1640995200000) // 1er janvier 2022

describe('avatar utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Date.now = mockDateNow
  })

  afterAll(() => {
    Date.now = originalDateNow
  })

  describe('useAvatar', () => {
    it('devrait retourner une fonction getUserAvatar', () => {
      const { getUserAvatar } = useAvatar()

      expect(typeof getUserAvatar).toBe('function')
    })

    it('devrait utiliser un avatar avec initiales vides pour un utilisateur null', () => {
      const { getUserAvatar } = useAvatar()

      const url = getUserAvatar(null as any)

      // Should return an SVG with empty initials
      expect(url).toContain('data:image/svg+xml;base64,')
    })

    it('devrait utiliser un avatar avec initiales vides pour un utilisateur sans email ni emailHash', () => {
      const { getUserAvatar } = useAvatar()

      const user = { profilePicture: null }
      const url = getUserAvatar(user as any)

      // Should return an SVG with empty initials
      expect(url).toContain('data:image/svg+xml;base64,')
    })

    it("devrait utiliser profilePicture si c'est une URL absolue HTTP", () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        profilePicture: 'http://example.com/avatar.jpg',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('http://example.com/avatar.jpg')
    })

    it("devrait utiliser profilePicture si c'est une URL absolue HTTPS", () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        profilePicture: 'https://example.com/avatar.jpg',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('https://example.com/avatar.jpg')
    })

    it('devrait construire URL profilePicture avec getImageUrl et updatedAt', () => {
      const { getUserAvatar } = useAvatar()

      mockGetImageUrl.mockReturnValue('/uploads/profiles/1/avatar.jpg')

      const user = {
        id: 1,
        email: 'test@example.com',
        profilePicture: 'avatar.jpg',
        updatedAt: '2022-01-01T10:00:00Z',
      }

      const url = getUserAvatar(user)

      expect(mockGetImageUrl).toHaveBeenCalledWith('avatar.jpg', 'profile', 1)
      expect(url).toBe('/uploads/profiles/1/avatar.jpg?v=1641031200000')
    })

    it("devrait utiliser Date.now() si pas d'updatedAt", () => {
      const { getUserAvatar } = useAvatar()

      mockGetImageUrl.mockReturnValue('/uploads/profiles/2/avatar.jpg')

      const user = {
        id: 2,
        email: 'test@example.com',
        profilePicture: 'avatar.jpg',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('/uploads/profiles/2/avatar.jpg?v=1640995200000')
      expect(mockDateNow).toHaveBeenCalled()
    })

    it('devrait retourner fallback si getImageUrl échoue', () => {
      const { getUserAvatar } = useAvatar()

      mockGetImageUrl.mockReturnValue(null)

      const user = {
        id: 3,
        email: 'test@example.com',
        profilePicture: 'invalid.jpg',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('https://www.gravatar.com/avatar/default?s=80&d=mp')
    })

    it('devrait utiliser emailHash directement si fourni', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        emailHash: 'abc123def456',
        email: 'test@example.com',
      }

      const url = getUserAvatar(user, 120)

      expect(url).toBe('https://www.gravatar.com/avatar/abc123def456?s=120&d=mp')
      expect(mockGetGravatarAvatar).not.toHaveBeenCalled()
    })

    it('devrait générer un avatar avec initiales basées sur le pseudo', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        pseudo: 'John Doe',
      }

      const url = getUserAvatar(user)

      // Should return an SVG with initials
      expect(url).toContain('data:image/svg+xml;base64,')
      // The SVG should contain "JD" for John Doe
      const decoded = atob(url.split(',')[1])
      expect(decoded).toContain('JD')
    })

    it('devrait utiliser la taille par défaut de 80px', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        emailHash: 'abc123def456',
      }

      const url = getUserAvatar(user)

      expect(url).toContain('s=80')
    })

    it('devrait respecter la taille personnalisée', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        pseudo: 'Test',
      }

      const url = getUserAvatar(user, 200)

      // Should return an SVG
      expect(url).toContain('data:image/svg+xml;base64,')
      // The SVG should include the size
      const decoded = atob(url.split(',')[1])
      expect(decoded).toContain('width="200"')
      expect(decoded).toContain('height="200"')
    })

    it('devrait prioriser profilePicture sur email et emailHash', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        emailHash: 'abc123def456',
        profilePicture: 'https://example.com/avatar.jpg',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('https://example.com/avatar.jpg')
      expect(mockGetGravatarAvatar).not.toHaveBeenCalled()
    })

    it('devrait prioriser emailHash sur email', () => {
      const { getUserAvatar } = useAvatar()

      const user = {
        email: 'test@example.com',
        emailHash: 'abc123def456',
      }

      const url = getUserAvatar(user)

      expect(url).toBe('https://www.gravatar.com/avatar/abc123def456?s=80&d=mp')
      expect(mockGetGravatarAvatar).not.toHaveBeenCalled()
    })

    it("devrait gérer les différents cas d'utilisateurs", () => {
      const { getUserAvatar } = useAvatar()

      const testCases = [
        // Utilisateur complet avec photo de profil
        {
          user: {
            email: 'test@example.com',
            emailHash: 'hash123',
            profilePicture: 'https://example.com/pic.jpg',
            updatedAt: '2022-01-01T00:00:00Z',
          },
          expected: 'profile-picture',
        },
        // Utilisateur avec emailHash seulement
        {
          user: {
            emailHash: 'hash456',
          },
          expected: 'gravatar',
        },
        // Utilisateur avec email seulement (will generate initials)
        {
          user: {
            email: 'user@test.com',
            pseudo: 'Test User',
          },
          expected: 'initials',
        },
      ]

      testCases.forEach(({ user, expected }, index) => {
        vi.clearAllMocks()

        const url = getUserAvatar(user as any)

        if (expected === 'profile-picture') {
          expect(url).toBe('https://example.com/pic.jpg')
        } else if (expected === 'gravatar') {
          expect(url).toBe('https://www.gravatar.com/avatar/hash456?s=80&d=mp')
        } else if (expected === 'initials') {
          expect(url).toContain('data:image/svg+xml;base64,')
        }
      })
    })
  })
})
