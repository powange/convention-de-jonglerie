import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../generated/prisma/client'

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

// Parse DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Parse MySQL connection URL (format: mysql://user:password@host:port/database)
const url = new URL(databaseUrl)

// Create Prisma adapter with MariaDB driver
// L'adaptateur gère automatiquement le pool de connexions
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  connectionLimit: 10,
  bigIntAsNumber: true,
})

// Create Prisma Client with adapter
const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: getPrismaLogLevel() as any,
    adapter,
  })

// En développement, stocker l'instance dans global pour éviter les reconnexions lors des hot reloads
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

// Gérer la fermeture propre de la connexion
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma
