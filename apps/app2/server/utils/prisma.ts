import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import { PrismaClient, Prisma } from '../generated/prisma/client'

export { Prisma }

/**
 * Singleton Prisma Client pour éviter les multiples connexions lors des hot reloads.
 */
declare global {
  var __prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("La variable d'environnement DATABASE_URL n'est pas définie")
}

// Adaptateur SQLite (Prisma 7 utilise les driver adapters)
const adapter = new PrismaBetterSqlite3({ url: databaseUrl })

const prisma = globalThis.__prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
