/**
 * Super administrateurs de Flowvent en ligne de commande : `npm run admin:add|admin:remove
 * <email>`, `npm run admin:list` — notamment pour nommer le PREMIER administrateur, que
 * l'interface (`/admin`) ne peut pas créer. La logique est commune avec app1
 * (`layers/core/scripts/gestion-administrateurs.ts`) ; ici, seulement le client Prisma de
 * Flowvent, dont le compte n'a que le drapeau (pas de date de promotion).
 */
import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { gererAdministrateurs } from '../../../layers/core/scripts/gestion-administrateurs'
import { PrismaClient } from '../server/generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL non définie')
  process.exit(1)
}

const url = new URL(databaseUrl)
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 2,
  }),
})

process.exitCode = await gererAdministrateurs({
  prisma: prisma as never,
  donneesPromotion: (estAdmin) => ({ isGlobalAdmin: estAdmin }),
  args: process.argv.slice(2),
})
