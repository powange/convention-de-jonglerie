declare module '#auth-utils' {
  import type { H3Event } from 'h3'
  export interface SessionUser { id: number; [key: string]: unknown }
  export function requireUserSession(event: H3Event): Promise<{ user: SessionUser }>
  export function getUserSession(event: H3Event): Promise<{ user?: SessionUser }>
  export function setUserSession(event: H3Event, data: { user: SessionUser }): Promise<void>
  export function clearUserSession(event: H3Event): Promise<void>
}
