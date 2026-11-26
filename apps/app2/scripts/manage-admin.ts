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

/**
 * En release et en production, `DATABASE_URL` n'existe que dans le processus de l'entrypoint, qui
 * la construit à partir de MYSQL_* : une console ouverte dans le conteneur ne l'a pas. Même règle
 * et mêmes défauts que docker/entrypoint.sh, pour que `npm run admin:add` y fonctionne aussi.
 */
function urlDeLaBase(): string | null {
  const v = process.env
  if (v.DATABASE_URL) return v.DATABASE_URL
  if (!v.MYSQL_USER || !v.MYSQL_PASSWORD) return null
  const e = encodeURIComponent
  const hote = v.DATABASE_HOST || 'flowvent-db'
  const port = v.DATABASE_PORT || '3306'
  return `mysql://${e(v.MYSQL_USER)}:${e(v.MYSQL_PASSWORD)}@${hote}:${port}/${e(v.MYSQL_DATABASE || 'flowvent_db')}`
}

const databaseUrl = urlDeLaBase()
if (!databaseUrl) {
  console.error(
    '❌ DATABASE_URL non définie, et MYSQL_USER / MYSQL_PASSWORD absents pour la construire'
  )
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
