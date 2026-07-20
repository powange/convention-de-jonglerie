import 'dotenv/config'
import { env } from 'prisma/config'

import type { PrismaConfig } from 'prisma'

export default {
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Shadow DB dédiée (MySQL sur tmpfs, service `shadow-db` du compose dev) : `migrate dev` y
    // reconstruit tout le schéma pour détecter les divergences. La faire tourner en RAM évite le
    // rejeu très lent (~2 min 28 s) sur le volume disque. Voir docs/optimization/prisma-migrate-shadow-db.md
    //
    // Volontairement `process.env` et non `env()` : si SHADOW_DATABASE_URL est absente (CI, autre
    // dev, conteneur qui ne fait que `migrate deploy`), on laisse `undefined` → Prisma retombe sur
    // la shadow auto-créée (comportement actuel). `env()` lèverait et casserait toutes les commandes.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
} satisfies PrismaConfig
