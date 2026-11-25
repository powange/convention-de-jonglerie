import { randomBytes } from 'crypto'

/**
 * Génère un token aléatoire sécurisé
 * @param length Longueur du token en bytes (par défaut 16)
 * @returns Token en format hexadécimal
 */
export function generateSecureToken(length: number = 16): string {
  return randomBytes(length).toString('hex')
}

/**
 * Génère un token pour un QR code de bénévole
 * Format: 32 caractères hexadécimaux (16 bytes)
 * @returns Token unique pour QR code
 */
export function generateVolunteerQrCodeToken(): string {
  return generateSecureToken(16) // 16 bytes = 32 caractères hex
}
