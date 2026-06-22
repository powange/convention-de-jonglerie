import { randomBytes, timingSafeEqual } from 'node:crypto'

import { getCookie, setCookie, getHeader } from 'h3'

import type { H3Event } from 'h3'

const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'x-csrf-token'
const TOKEN_BYTE_LENGTH = 32

/**
 * Récupère le token CSRF du cookie ou en génère un nouveau et le set dans la réponse.
 * À appeler sur les requêtes GET pour s'assurer que le client a un token avant de
 * faire une mutation.
 */
export function ensureCsrfToken(event: H3Event): string {
  let token = getCookie(event, CSRF_COOKIE)
  if (!token || token.length !== TOKEN_BYTE_LENGTH * 2) {
    token = randomBytes(TOKEN_BYTE_LENGTH).toString('hex')
    setCookie(event, CSRF_COOKIE, token, {
      httpOnly: false, // Le JS doit pouvoir lire le token pour l'injecter en header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    })
  }
  return token
}

/**
 * Compare deux strings en temps constant pour éviter les timing attacks.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Valide que la requête contient un header `x-csrf-token` correspondant au cookie.
 * Pattern Double Submit Cookie : un attaquant ne peut pas lire le cookie d'une
 * autre origine (Same-Origin Policy) et donc ne peut pas forger le bon header.
 *
 * @throws Error 403 si le token est absent ou invalide
 */
export function assertCsrfToken(event: H3Event): void {
  const cookieToken = getCookie(event, CSRF_COOKIE)
  const headerToken = getHeader(event, CSRF_HEADER)

  if (!cookieToken || !headerToken) {
    throw createError({
      status: 403,
      message: 'CSRF token manquant',
    })
  }

  if (!constantTimeEquals(cookieToken, headerToken)) {
    throw createError({
      status: 403,
      message: 'CSRF token invalide',
    })
  }
}
