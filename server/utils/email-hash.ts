import md5 from 'md5'

import { sanitizeEmail } from './validation-helpers'

/**
 * Génère le hash MD5 d'un email pour Gravatar
 * @param email - L'adresse email à hasher
 * @returns Le hash MD5 de l'email normalisé
 */
export function getEmailHash(email: string): string {
  if (!email) return ''

  // Normaliser l'email (minuscules et supprimer les espaces)
  const normalizedEmail = sanitizeEmail(email)

  // Créer le hash MD5 de l'email
  return md5(normalizedEmail)
}
