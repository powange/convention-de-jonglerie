import { vi, beforeEach } from 'vitest'

// Mock centralisé de Prisma pour tests unitaires
const createModelMock = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn()
})

export const prismaMock = {
  // Modèles d'authentification
  user: createModelMock(),
  passwordResetToken: createModelMock(),
  
  // Modèles principaux
  convention: createModelMock(),
  conventionCollaborator: createModelMock(),
  edition: createModelMock(),
  editionCollaboratorPermission: createModelMock(),
  editionCollaborator: createModelMock(),
  editionPost: createModelMock(),
  editionPostComment: createModelMock(),
  collaboratorPermissionHistory: createModelMock(),
  
  // Modèles objets trouvés
  lostFoundItem: createModelMock(),
  lostFoundComment: createModelMock(),
  
  // Modèles covoiturage
  carpoolOffer: createModelMock(),
  carpoolRequest: createModelMock(),
  carpoolComment: createModelMock(),
  carpoolRequestComment: createModelMock(),
  
  // Méthodes Prisma
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn()
}

// Reset automatique avant chaque test
beforeEach(() => {
  vi.clearAllMocks()
})

// Export de compatibilité
export const prisma = prismaMock