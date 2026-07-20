import 'dotenv/config'
import { env } from 'prisma/config'

import type { PrismaConfig } from 'prisma'

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Shadow DB dédiée (service `flowvent-shadow-db` sur tmpfs) : `migrate dev` y reconstruit le
    // schéma. La faire tourner en RAM évite le rejeu très lent sur le volume disque. `process.env`
    // (et non `env()`) : si SHADOW_DATABASE_URL est absente, on retombe sans erreur sur la shadow
    // auto-créée. Voir apps/app1/docs/optimization/prisma-migrate-shadow-db.md.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
} satisfies PrismaConfig
