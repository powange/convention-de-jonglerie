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
  export function replaceUserSession(event: H3Event, data: Partial<UserSession>): Promise<void>
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

// Pas d'augmentation de '#imports' ici : une déclaration de module ambiante prend le pas
// sur la résolution par `paths`, et masquait donc tout ce que Nuxt y expose réellement —
// stores, composables, utilitaires. Quatre-vingt-treize erreurs TS2305 dans les layers, qui
// importent explicitement depuis '#imports', là où le code d'app1 s'en remet aux imports
// automatiques. Les helpers de session sont déjà déclarés par Nuxt et Nitro.
