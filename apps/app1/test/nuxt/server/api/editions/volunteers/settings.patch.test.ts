import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockCanManage } }),
}))

import handler from '../../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/settings.patch'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/volunteers/settings PATCH', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }
  const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

  // Récupère l'objet `update` passé à l'upsert Prisma
  const updateData = () => prismaMock.eventVolunteerSettings.upsert.mock.calls[0][0].update

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    mockCanManage.mockResolvedValue(true)
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ mode: 'INTERNAL' })
    prismaMock.eventVolunteerSettings.upsert.mockResolvedValue({ eventId: 1 })
  })

  describe('PATCH partiel : ne touche pas aux champs absents', () => {
    it('ne réinitialise pas la description quand seul `open` est envoyé', async () => {
      global.readBody = vi.fn().mockResolvedValue({ open: true })

      await handler(baseEvent as any)

      expect(updateData()).not.toHaveProperty('description')
      expect(updateData().open).toBe(true)
    })

    it('ne réinitialise pas la description quand seul `pagePublic` est envoyé', async () => {
      global.readBody = vi.fn().mockResolvedValue({ pagePublic: true })

      await handler(baseEvent as any)

      expect(updateData()).not.toHaveProperty('description')
    })

    it("ne réinitialise ni la description ni l'URL externe lors d'un changement de mode", async () => {
      global.readBody = vi.fn().mockResolvedValue({ mode: 'INTERNAL' })

      await handler(baseEvent as any)

      expect(updateData()).not.toHaveProperty('description')
      expect(updateData()).not.toHaveProperty('externalUrl')
    })

    it("ne réinitialise pas la description lors d'un enregistrement des questions du formulaire", async () => {
      global.readBody = vi.fn().mockResolvedValue({ askDiet: true, askAllergies: false })

      await handler(baseEvent as any)

      expect(updateData()).not.toHaveProperty('description')
      expect(updateData().askDiet).toBe(true)
      expect(updateData().askAllergies).toBe(false)
    })

    it('ne déclenche aucune écriture quand le body est vide', async () => {
      global.readBody = vi.fn().mockResolvedValue({})

      const result = await handler(baseEvent as any)

      expect(prismaMock.eventVolunteerSettings.upsert).not.toHaveBeenCalled()
      expect(result.data).toEqual({ unchanged: true })
    })
  })

  describe('Description : écriture et effacement explicites', () => {
    it('enregistre la description envoyée', async () => {
      global.readBody = vi.fn().mockResolvedValue({ description: 'Rejoignez-nous !' })

      await handler(baseEvent as any)

      expect(updateData().description).toBe('Rejoignez-nous !')
    })

    it('efface la description quand `null` est envoyé', async () => {
      global.readBody = vi.fn().mockResolvedValue({ description: null })

      await handler(baseEvent as any)

      expect(updateData().description).toBeNull()
    })

    it('efface la description quand une chaîne vide est envoyée', async () => {
      global.readBody = vi.fn().mockResolvedValue({ description: '' })

      await handler(baseEvent as any)

      expect(updateData().description).toBeNull()
    })
  })

  describe('URL externe', () => {
    it("conserve l'URL externe quand le champ est absent en mode EXTERNAL", async () => {
      prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ mode: 'EXTERNAL' })
      global.readBody = vi.fn().mockResolvedValue({ open: false })

      await handler(baseEvent as any)

      expect(updateData()).not.toHaveProperty('externalUrl')
    })

    it('rejette une URL externe vidée en mode EXTERNAL', async () => {
      prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ mode: 'EXTERNAL' })
      global.readBody = vi.fn().mockResolvedValue({ externalUrl: null })

      await expect(handler(baseEvent as any)).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(prismaMock.eventVolunteerSettings.upsert).not.toHaveBeenCalled()
    })
  })

  describe('Permissions', () => {
    it('rejette un utilisateur sans droit de gestion des bénévoles', async () => {
      mockCanManage.mockResolvedValue(false)
      global.readBody = vi.fn().mockResolvedValue({ description: 'Coucou' })

      await expect(handler(baseEvent as any)).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.eventVolunteerSettings.upsert).not.toHaveBeenCalled()
    })
  })
})
