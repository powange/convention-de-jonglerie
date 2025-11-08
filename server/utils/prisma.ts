import { PrismaClient } from '@prisma/client'

/**
 * Singleton Prisma Client pour éviter les multiples connexions à la base de données
 * Réutilise la même instance à travers toute l'application
 */
declare global {
  var __prisma: PrismaClient | undefined
}

// Configuration des logs Prisma basée sur PRISMA_LOG_LEVEL
// Valeurs possibles: 'query', 'info', 'warn', 'error', ou combinaisons séparées par ','
// Exemple: PRISMA_LOG_LEVEL='error,warn' ou PRISMA_LOG_LEVEL='query,error,warn,info'
const getPrismaLogLevel = () => {
  const logLevel = process.env.PRISMA_LOG_LEVEL
  if (logLevel) {
    return logLevel.split(',').map((level) => level.trim())
  }
  // Fallback: en dev on affiche tout, en prod seulement les erreurs
  return process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
}

export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: getPrismaLogLevel() as any,
  })

// En développement, stocker l'instance dans global pour éviter les reconnexions lors des hot reloads
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

// Gérer la fermeture propre de la connexion
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
