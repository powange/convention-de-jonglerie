import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from '../../../../../server/api/conventions/[id]/editions.get';
import { prismaMock } from '../../../../__mocks__/prisma';
import { checkUserConventionPermission } from '../../../../../server/utils/collaborator-management';

vi.mock('../../../../../server/utils/collaborator-management', () => ({
  checkUserConventionPermission: vi.fn(),
}));

const mockCheck = checkUserConventionPermission as ReturnType<typeof vi.fn>;

const baseEvent = {
  context: {
    params: { id: '1' },
    user: { id: 10 }
  }
};

describe('/api/conventions/[id]/editions GET', () => {
  beforeEach(() => {
    mockCheck.mockReset();
    prismaMock.edition.findMany.mockReset();
  });

  it('retourne les editions avec succès', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true, userRole: 'ADMINISTRATOR', isOwner: true, isCollaborator: false });
    const editions = [
      { id: 1, name: 'Edition 1', startDate: new Date('2024-01-01'), endDate: new Date('2024-01-05') },
      { id: 2, name: 'Edition 2', startDate: new Date('2024-02-01'), endDate: new Date('2024-02-05') }
    ];
    prismaMock.edition.findMany.mockResolvedValue(editions);

    const res = await handler(baseEvent as any);
    expect(res).toEqual(editions);
    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({ where: { conventionId: 1 }, select: { id: true, name: true, startDate: true, endDate: true } });
  });

  it('rejette utilisateur non authentifié', async () => {
    await expect(handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)).rejects.toThrow('Non authentifié');
  });

  it('rejette si pas de permission', async () => {
    mockCheck.mockResolvedValue({ hasPermission: false });
    await expect(handler(baseEvent as any)).rejects.toThrow('Accès refusé');
  });

  it('valide id invalide', async () => {
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '0' } } };
    await expect(handler(ev as any)).rejects.toThrow('ID invalide');
  });

  it('retourne tableau vide si aucune édition', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true });
    prismaMock.edition.findMany.mockResolvedValue([]);
    const res = await handler(baseEvent as any);
    expect(res).toEqual([]);
  });

  it('accepte conversion ID numérique', async () => {
    mockCheck.mockResolvedValue({ hasPermission: true });
    prismaMock.edition.findMany.mockResolvedValue([]);
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '42' } } };
    await handler(ev as any);
    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({ where: { conventionId: 42 }, select: { id: true, name: true, startDate: true, endDate: true } });
  });
});
