import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireUserSession = vi.hoisted(() => vi.fn())

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans le handler.
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('nuxt-auth-utils', () => ({
  getUserSession: vi.fn(),
  requireUserSession: mockRequireUserSession,
  setUserSession: vi.fn(),
  clearUserSession: vi.fn(),
}))

vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageEditionOrganizers: vi.fn(),
  canManageTicketing: vi.fn(),
}))

import {
  canManageEditionOrganizers,
  canManageTicketing,
} from '../../../../../../../server/utils/permissions/edition-permissions'
import handler from '../../../../../../../server/api/editions/[id]/organizers/edition-organizers.get'

const prismaMock = (globalThis as any).prisma
const mockCanManageOrganizers = canManageEditionOrganizers as ReturnType<typeof vi.fn>
const mockCanManageTicketing = canManageTicketing as ReturnType<typeof vi.fn>

const mockEvent = { context: { params: { id: '17' } } }

const dbOrganizers = [
  {
    id: 1,
    organizerId: 10,
    entryValidated: true,
    entryValidatedAt: new Date('2026-07-01'),
    createdAt: new Date('2026-06-01'),
    organizer: {
      id: 10,
      title: 'Trésorier',
      user: {
        id: 100,
        pseudo: 'orga',
        prenom: 'Jean',
        nom: 'Dupont',
        pronouns: null,
        email: 'jean@example.com',
        emailHash: 'hash',
        phone: '0600000000',
        profilePicture: null,
      },
    },
  },
]

describe('GET /api/editions/[id]/organizers/edition-organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUserSession.mockResolvedValue({ user: { id: 1, isGlobalAdmin: false } })
    prismaMock.edition.findUnique.mockReset()
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 17,
      convention: { organizers: [] },
      organizerPermissions: [],
    })
    prismaMock.editionOrganizer.findMany.mockReset()
    prismaMock.editionOrganizer.findMany.mockResolvedValue(dbOrganizers)
  })

  it('rejette (404) si édition introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)
    await expect(handler(mockEvent as any)).rejects.toThrow('Edition not found')
  })

  it('rejette (403) si ni gestionnaire organisateurs ni gestionnaire billetterie', async () => {
    mockCanManageOrganizers.mockReturnValue(false)
    mockCanManageTicketing.mockReturnValue(false)
    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour gérer les organisateurs"
    )
  })

  it('gestionnaire organisateurs : accès + infos sensibles (email/téléphone) présentes', async () => {
    mockCanManageOrganizers.mockReturnValue(true)
    mockCanManageTicketing.mockReturnValue(false)

    const res = await handler(mockEvent as any)

    expect(res.data.organizers).toHaveLength(1)
    expect(res.data.organizers[0].user.nom).toBe('Dupont')
    expect(res.data.organizers[0].user.email).toBe('jean@example.com')
    expect(res.data.organizers[0].user.phone).toBe('0600000000')
  })

  // RÉGRESSION : un gestionnaire billetterie (sans droit sur les organisateurs) doit
  // pouvoir lister les organisateurs (pour handout-items) MAIS sans infos sensibles.
  it('gestionnaire billetterie seul : accès autorisé, MAIS sans email ni téléphone', async () => {
    mockCanManageOrganizers.mockReturnValue(false)
    mockCanManageTicketing.mockReturnValue(true)

    const res = await handler(mockEvent as any)

    expect(res.data.organizers).toHaveLength(1)
    expect(res.data.organizers[0].user.nom).toBe('Dupont') // noms/avatars OK
    expect(res.data.organizers[0].user).not.toHaveProperty('email')
    expect(res.data.organizers[0].user).not.toHaveProperty('phone')
  })
})
