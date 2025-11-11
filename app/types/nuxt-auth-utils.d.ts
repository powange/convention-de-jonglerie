declare module '#auth-utils' {
  import type { H3Event } from 'h3'

  export interface SessionUser {
    id: number
    [key: string]: unknown
  }

  export interface ImpersonationData {
    active: boolean
    originalUserId: number
    originalUserEmail: string
    originalUserPseudo: string
    originalUserNom: string
    originalUserPrenom: string
    targetUserId: number
    targetUserEmail: string
    startedAt: string
  }

  export interface UserSession {
    user: SessionUser
    impersonation?: ImpersonationData
    [key: string]: unknown
  }

  export function requireUserSession(event: H3Event): Promise<UserSession & { user: SessionUser }>
  export function getUserSession(
    event: H3Event
  ): Promise<Partial<UserSession> & { user?: SessionUser }>
  export function setUserSession(event: H3Event, data: Partial<UserSession>): Promise<void>
  export function clearUserSession(event: H3Event): Promise<void>
  // Helper OAuth Google (exposé par nuxt-auth-utils via #imports)
  export function defineOAuthGoogleEventHandler(handler: {
    config?: Record<string, any>
    onSuccess: (
      event: H3Event,
      payload: { user?: { id?: string; email?: string; name?: string; image?: string } }
    ) => any | Promise<any>
    onError?: (event: H3Event, error: any) => any | Promise<any>
  }): any
}

// Augmentation de '#imports' pour la complétion/typage côté serveur
declare module '#imports' {
  import type { UserSession, ImpersonationData } from '#auth-utils'

  import type { H3Event } from 'h3'

  export function requireUserSession(event: H3Event): Promise<UserSession & { user: any }>
  export function getUserSession(event: H3Event): Promise<Partial<UserSession> & { user?: any }>
  export function setUserSession(event: H3Event, data: Partial<UserSession>): Promise<void>
  export function clearUserSession(event: H3Event): Promise<void>
  export const defineOAuthGoogleEventHandler: (handler: {
    config?: Record<string, any>
    onSuccess: (
      event: H3Event,
      payload: { user?: { id?: string; email?: string; name?: string; image?: string } }
    ) => any | Promise<any>
    onError?: (event: H3Event, error: any) => any | Promise<any>
  }) => any
  export type { UserSession, ImpersonationData }
}
