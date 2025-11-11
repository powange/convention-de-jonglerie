import { getCookie, setCookie, deleteCookie } from 'h3'

import type { H3Event } from 'h3'

const IMPERSONATION_COOKIE = 'impersonation'

export interface ImpersonationData {
  active: boolean
  originalUserId: number
  originalUserEmail: string
  originalUserPseudo: string
  originalUserNom: string | null
  originalUserPrenom: string | null
  targetUserId: number
  targetUserEmail: string
  startedAt: string
}

/**
 * Définit les données d'impersonation dans un cookie séparé
 */
export function setImpersonationCookie(event: H3Event, data: ImpersonationData) {
  setCookie(event, IMPERSONATION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 heures
    path: '/',
  })
}

/**
 * Récupère les données d'impersonation depuis le cookie
 */
export function getImpersonationCookie(event: H3Event): ImpersonationData | null {
  const cookie = getCookie(event, IMPERSONATION_COOKIE)
  if (!cookie) return null

  try {
    return JSON.parse(cookie) as ImpersonationData
  } catch {
    return null
  }
}

/**
 * Supprime le cookie d'impersonation
 */
export function clearImpersonationCookie(event: H3Event) {
  deleteCookie(event, IMPERSONATION_COOKIE, {
    path: '/',
  })
}
