import md5 from 'md5'

import { sanitizeEmail } from './validation-helpers'

// Cache en mémoire pour les hash d'emails
const emailHashCache = new Map<string, string>()

/**
 * Génère le hash MD5 d'un email pour Gravatar (avec cache)
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
  const hash = md5(normalizedEmail)

  // Mettre en cache
  emailHashCache.set(email, hash)

  return hash
}
