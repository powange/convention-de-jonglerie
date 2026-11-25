/**
 * Super administrateurs d'app1 en ligne de commande : `npm run admin:add|admin:remove <email>`,
 * `npm run admin:list`. La logique est commune avec Flowvent
 * (`layers/core/scripts/gestion-administrateurs.ts`) ; ici, seulement le client Prisma d'app1 et
 * ce qu'une promotion écrit (le drapeau ET sa date, comme le point d'API — constat B7).
 */
import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { gererAdministrateurs } from '../../../layers/core/scripts/gestion-administrateurs'
import { PrismaClient } from '../server/generated/prisma/client'
import { donneesDePromotionAdmin } from '../shared/utils/promotion-administrateur'

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
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    connectionLimit: 2,
    bigIntAsNumber: true,
    allowPublicKeyRetrieval: true,
  }),
})

process.exitCode = await gererAdministrateurs({
  prisma: prisma as never,
  donneesPromotion: (estAdmin) => donneesDePromotionAdmin(estAdmin),
  args: process.argv.slice(2),
})
