import { createHash } from 'node:crypto'

import { sanitizeEmail } from './validation-helpers'

// Cache en mémoire pour les hash d'emails
const emailHashCache = new Map<string, string>()

/**
 * Génère le hash MD5 d'un email pour Gravatar (avec cache).
 * Utilise le module `node:crypto` natif (app2 n'a pas la dépendance `md5`).
 * @param email - L'adresse email à hasher
 * @returns Le hash MD5 de l'email normalisé
 */
export function getEmailHash(email: string): string {
  if (!email) return ''

  // Vérifier le cache
  if (emailHashCache.has(email)) {
    return emailHashCache.get(email)!
  }

  // Normaliser l'email (minuscules et supprimer les espaces)
  const normalizedEmail = sanitizeEmail(email)

  // Créer le hash MD5 de l'email
  const hash = createHash('md5').update(normalizedEmail).digest('hex')

  // Mettre en cache
  emailHashCache.set(email, hash)

  return hash
}
