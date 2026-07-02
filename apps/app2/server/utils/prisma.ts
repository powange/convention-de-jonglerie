import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

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

// Adaptateur MySQL/MariaDB (Prisma 7 utilise les driver adapters).
// Format attendu : mysql://user:password@host:port/database
const url = new URL(databaseUrl)
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 10,
})

const prisma = globalThis.__prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
