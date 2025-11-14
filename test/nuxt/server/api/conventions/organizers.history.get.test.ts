import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  checkUserConventionPermission: vi.fn(),
}))

import { checkUserConventionPermission } from '@@/server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/organizers/history.get'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockCheck = checkUserConventionPermission as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '7' },
    user: { id: 99 },
  },
}

describe('/api/conventions/[id]/organizers/history GET', () => {
  beforeEach(() => {
    mockCheck.mockReset()
    prismaMock.organizerPermissionHistory.findMany.mockReset()
  })

  it("retourne l'historique avec actor & targetUser + avatars", async () => {
    mockCheck.mockResolvedValue({ hasPermission: true })
    const history = [
      {
        id: 1,
        changeType: 'RIGHTS_UPDATED',
        createdAt: new Date(),
        before: {},
        after: {},
        actorId: 99,
        targetUserId: 50,
        actor: {
          id: 99,
          pseudo: 'Acteur',
          profilePicture: '/img/a1.png',
          email: 'actor@example.tld',
        },
        targetUser: { id: 50, pseudo: 'Cible', profilePicture: null, email: 'target@example.tld' },
      },
      {
        id: 2,
        changeType: 'PER_EDITIONS_UPDATED',
        createdAt: new Date(),
        before: {},
        after: {},
        actorId: 99,
        targetUserId: 51,
        actor: { id: 99, pseudo: 'Acteur', profilePicture: null, email: 'actor@example.tld' },
        targetUser: {
          id: 51,
          pseudo: 'Autre',
          profilePicture: '/img/u2.png',
          email: 'other@example.tld',
        },
      },
    ] as any
    prismaMock.organizerPermissionHistory.findMany.mockResolvedValue(history)
    const res = await handler(baseEvent as any)
    expect(res.length).toBe(2)
    // Vérifie mapping des utilisateurs
    const first = res[0]
    expect(first.actor.pseudo).toBe('Acteur')
    expect(first.actor.profilePicture).toBe('/img/a1.png')
    expect(first.actor.emailHash).toBeDefined()
    expect(first.targetUser.profilePicture).toBeNull()
    expect(first.targetUser.emailHash).toBeDefined()
    const second = res[1]
    expect(second.actor.profilePicture).toBeNull()
    expect(second.actor.emailHash).toBeDefined()
    expect(second.targetUser.profilePicture).toBe('/img/u2.png')
    expect(second.targetUser.emailHash).toBeDefined()
    expect(prismaMock.organizerPermissionHistory.findMany).toHaveBeenCalledWith({
      where: { conventionId: 7 },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: { select: { id: true, pseudo: true, profilePicture: true, email: true } },
        targetUser: { select: { id: true, pseudo: true, profilePicture: true, email: true } },
      },
    })
  })

  it('rejette non authentifié', async () => {
    await expect(
      handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)
    ).rejects.toThrow('Unauthorized')
  })

  it('rejette si pas permission', async () => {
    mockCheck.mockResolvedValue({ hasPermission: false })
    await expect(handler(baseEvent as any)).rejects.toThrow('Accès refusé')
  })

  it('retourne tableau vide si aucun historique', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true })
    prismaMock.organizerPermissionHistory.findMany.mockResolvedValue([])
    const res = await handler(baseEvent as any)
    expect(res).toEqual([])
  })
})
