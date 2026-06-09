#!/usr/bin/env tsx
/**
 * OUTIL DE DEBUG LOCAL — réversible. Échange temporairement le mot de passe d'un
 * utilisateur pour permettre un login direct, puis le restaure.
 *
 *   npx tsx scripts/_temp-password-swap.ts swap <email> <tempPassword>
 *   npx tsx scripts/_temp-password-swap.ts restore <email>
 *
 * Le hash d'origine est sauvegardé dans .pwd-swap-backup.json (supprimé au restore).
 * NE JAMAIS exécuter en production.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

import bcrypt from 'bcryptjs'

import prisma from '../server/utils/prisma.js'

const BACKUP = new URL('../.pwd-swap-backup.json', import.meta.url)
const [mode, email, tempPassword] = process.argv.slice(2)

/**
 * Refuse de s'exécuter hors environnement de développement local.
 * Couche 1 : variables d'environnement (NODE_ENV / NUXT_ENV).
 * Couche 2 : hôte de la base de données (doit être local / service Docker).
 * Override explicite possible via ALLOW_PASSWORD_SWAP=I_KNOW (à éviter).
 */
function assertDevEnvironment() {
  const override = process.env.ALLOW_PASSWORD_SWAP === 'I_KNOW'

  // Couche 1 : indicateurs d'environnement
  const nodeEnv = process.env.NODE_ENV
  const nuxtEnv = process.env.NUXT_ENV
  if (nodeEnv === 'production' || nuxtEnv === 'staging' || nuxtEnv === 'release') {
    if (!override) {
      console.error(
        `❌ Refus : environnement non-dev détecté (NODE_ENV=${nodeEnv}, NUXT_ENV=${nuxtEnv}). ` +
          `Ce script modifie des mots de passe et est réservé au développement local.`
      )
      process.exit(1)
    }
  }

  // Couche 2 : hôte de la base de données (doit être local)
  const dbUrl = process.env.DATABASE_URL || ''
  const LOCAL_HOSTS = [
    'localhost',
    '127.0.0.1',
    '::1',
    'database',
    'db',
    'mariadb',
    'mysql',
    'host.docker.internal',
  ]
  let host = ''
  try {
    host = new URL(dbUrl).hostname
  } catch {
    // URL non parsable : on ne peut pas garantir que c'est local
  }
  const isLocalDb = host !== '' && LOCAL_HOSTS.includes(host)
  if (!isLocalDb && !override) {
    console.error(
      `❌ Refus : la base de données ne semble pas locale (host="${host || 'inconnu'}"). ` +
        `Réservé au développement local. (override: ALLOW_PASSWORD_SWAP=I_KNOW)`
    )
    process.exit(1)
  }
}

async function main() {
  if (!mode || !email) {
    console.error('Usage: swap <email> <tempPassword> | restore <email>')
    process.exit(1)
  }

  assertDevEnvironment()

  if (mode === 'swap') {
    if (!tempPassword) {
      console.error('tempPassword requis pour swap')
      process.exit(1)
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.error(`Utilisateur introuvable: ${email}`)
      process.exit(1)
    }
    // Sauvegarde du hash d'origine (refuse d'écraser un backup existant)
    if (existsSync(BACKUP)) {
      console.error('Un backup existe déjà (.pwd-swap-backup.json) — restaure-le d’abord.')
      process.exit(1)
    }
    writeFileSync(BACKUP, JSON.stringify({ email, id: user.id, originalHash: user.password }))
    await prisma.user.update({
      where: { email },
      data: { password: await bcrypt.hash(tempPassword, 10) },
    })
    console.log(`🔁 Mot de passe temporaire posé pour ${email} (id=${user.id}). Backup OK.`)
  } else if (mode === 'restore') {
    if (!existsSync(BACKUP)) {
      console.error('Aucun backup (.pwd-swap-backup.json) à restaurer.')
      process.exit(1)
    }
    const data = JSON.parse(readFileSync(BACKUP, 'utf8'))
    if (data.email !== email) {
      console.error(`Backup pour ${data.email}, pas ${email}. Abandon.`)
      process.exit(1)
    }
    await prisma.user.update({
      where: { email },
      data: { password: data.originalHash },
    })
    unlinkSync(BACKUP)
    console.log(`♻️  Hash d'origine restauré pour ${email}. Backup supprimé.`)
  } else {
    console.error(`Mode inconnu: ${mode}`)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e)
    process.exit(1)
  })
