import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma Client pour éviter les multiples connexions à la base de données
 * Réutilise la même instance à travers toute l'application
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// En développement, stocker l'instance dans global pour éviter les reconnexions lors des hot reloads
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Gérer la fermeture propre de la connexion
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});