import { vi } from 'vitest'

// Mock de la base de données pour les tests
export const mockDatabase = {
  user: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  apiErrorLog: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  carpoolOffer: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  carpoolBooking: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  carpoolRequest: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  edition: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  favorite: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  convention: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}

// Mock du client Prisma
vi.mock('../../server/utils/prisma', () => ({
  prisma: mockDatabase,
}))

export const resetDatabase = async () => {
  // Réinitialiser tous les mocks
  Object.values(mockDatabase).forEach((table) => {
    Object.values(table).forEach((method) => {
      if (typeof method === 'function') {
        method.mockReset()
      }
    })
  })
}
