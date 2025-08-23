import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/conventions/[id]/collaborators/history.get';
import { prismaMock } from '../../../../__mocks__/prisma';
import { checkUserConventionPermission } from '../../../../../server/utils/collaborator-management';

vi.mock('../../../../../server/utils/collaborator-management', () => ({
  checkUserConventionPermission: vi.fn(),
}));

const mockCheck = checkUserConventionPermission as ReturnType<typeof vi.fn>;

const baseEvent = {
  context: {
    params: { id: '7' },
    user: { id: 99 }
  }
};

describe('/api/conventions/[id]/collaborators/history GET', () => {
  beforeEach(() => {
    mockCheck.mockReset();
    prismaMock.collaboratorPermissionHistory.findMany.mockReset();
  });

  it('retourne l\'historique', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true });
    const history = [
      { id: 1, changeType: 'RIGHTS_UPDATED', createdAt: new Date(), before: {}, after: {}, collaborator: { id: 9, userId: 50, title: null }, actor: { id: 99, pseudo: 'actor' } },
      { id: 2, changeType: 'PER_EDITIONS_UPDATED', createdAt: new Date(), before: {}, after: {}, collaborator: { id: 9, userId: 50, title: 'T' }, actor: { id: 99, pseudo: 'actor' } }
    ];
    prismaMock.collaboratorPermissionHistory.findMany.mockResolvedValue(history);
    const res = await handler(baseEvent as any);
    expect(res.length).toBe(2);
    expect(prismaMock.collaboratorPermissionHistory.findMany).toHaveBeenCalledWith({
      where: { conventionId: 7 },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { collaborator: { select: { id: true, userId: true, title: true } }, actor: { select: { id: true, pseudo: true } } }
    });
  });

  it('rejette non authentifié', async () => {
    await expect(handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)).rejects.toThrow('Non authentifié');
  });

  it('rejette si pas permission', async () => {
    mockCheck.mockResolvedValue({ hasPermission: false });
    await expect(handler(baseEvent as any)).rejects.toThrow('Accès refusé');
  });

  it('retourne tableau vide si aucun historique', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true });
    prismaMock.collaboratorPermissionHistory.findMany.mockResolvedValue([]);
    const res = await handler(baseEvent as any);
    expect(res).toEqual([]);
  });
});
