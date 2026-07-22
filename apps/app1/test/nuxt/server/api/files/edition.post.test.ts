import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des permissions — DOIT être avant les imports
vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  canEditEdition: vi.fn(),
  getEditionWithPermissions: vi.fn(),
}))

// Mock de storeFileLocally depuis nuxt-file-storage
vi.mock('#imports', async () => {
  const actual = await vi.importActual('#imports')
  return {
    ...actual,
    storeFileLocally: vi.fn(),
  }
})

import {
  canEditEdition,
  getEditionWithPermissions,
} from '../../../../../server/utils/permissions/edition-permissions'
import handler from '../../../../../server/api/files/edition.post'

const mockCanEditEdition = canEditEdition as ReturnType<typeof vi.fn>
const mockGetEdition = getEditionWithPermissions as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: {},
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = { context: { params: {} } }

// Édition où l'utilisateur a des droits SPÉCIFIQUES À L'ÉDITION (organizerPermissions),
// mais AUCUN droit au niveau convention. C'est exactement le cas qui renvoyait un 403
// avant le fix (le findUnique manuel n'incluait pas organizerPermissions).
const mockEditionEditionLevelRights = {
  id: 17,
  convention: { organizers: [] },
  organizerPermissions: [{ organizer: { userId: 1 }, canEdit: true }],
}

const mockFile = {
  name: 'affiche.jpg',
  filename: 'affiche.jpg',
  type: 'image/jpeg',
  size: '15',
  content: 'data:image/jpeg;base64,ZmFrZSBpbWFnZSBkYXRh',
  data: Buffer.from('fake image data'),
}

describe('/api/files/edition POST', () => {
  beforeEach(() => {
    mockCanEditEdition.mockReset()
    mockGetEdition.mockReset()
    global.readBody = vi.fn()
    global.storeFileLocally = vi.fn().mockResolvedValue('abc123-affiche.jpg')
  })

  it('smoke: handler importable', () => {
    expect(handler).toBeDefined()
    expect(typeof handler).toBe('function')
  })

  it('rejette si non authentifié', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('rejette si aucun fichier fourni', async () => {
    global.readBody.mockResolvedValue({ files: [], metadata: { entityId: '17' } })
    await expect(handler(mockEvent as any)).rejects.toThrow('Aucun fichier fourni')
  })

  it("rejette si entityId manquant", async () => {
    global.readBody.mockResolvedValue({ files: [mockFile], metadata: {} })
    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition requis")
  })

  it('rejette si édition introuvable', async () => {
    global.readBody.mockResolvedValue({ files: [mockFile], metadata: { entityId: '999' } })
    mockGetEdition.mockResolvedValue(null)
    await expect(handler(mockEvent as any)).rejects.toThrow('Édition introuvable')
  })

  it('rejette (403) si canEditEdition renvoie false', async () => {
    global.readBody.mockResolvedValue({ files: [mockFile], metadata: { entityId: '17' } })
    mockGetEdition.mockResolvedValue(mockEditionEditionLevelRights)
    mockCanEditEdition.mockReturnValue(false)
    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette édition"
    )
  })

  // RÉGRESSION : la permission doit être évaluée via getEditionWithPermissions,
  // qui inclut convention.organizers ET organizerPermissions. Un findUnique manuel
  // sans organizerPermissions rejetait à tort (403) les organisateurs n'ayant que
  // des droits au niveau de l'édition.
  it('utilise getEditionWithPermissions pour évaluer les permissions', async () => {
    global.readBody.mockResolvedValue({ files: [mockFile], metadata: { entityId: '17' } })
    mockGetEdition.mockResolvedValue(mockEditionEditionLevelRights)
    mockCanEditEdition.mockReturnValue(true)

    await handler(mockEvent as any)

    expect(mockGetEdition).toHaveBeenCalledWith(17, { userId: 1 })
  })

  it("autorise un organisateur ayant des droits au niveau de l'édition (upload OK, pas de 403)", async () => {
    global.readBody.mockResolvedValue({ files: [mockFile], metadata: { entityId: '17' } })
    mockGetEdition.mockResolvedValue(mockEditionEditionLevelRights)
    mockCanEditEdition.mockReturnValue(true)

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.imageUrl).toContain('/uploads/temp/editions/17/')
  })

  it('NEW_EDITION passe sans vérification de permission', async () => {
    global.readBody.mockResolvedValue({
      files: [mockFile],
      metadata: { entityId: 'NEW_EDITION' },
    })

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(mockGetEdition).not.toHaveBeenCalled()
    expect(result.data.imageUrl).toContain('/uploads/temp/editions/NEW_EDITION/')
  })
})
