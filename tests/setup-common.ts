import { vi } from 'vitest'

// Fallbacks globaux partagés entre suites de tests.
// Chaque suite peut surcharger ces valeurs ensuite.

// defineEventHandler passe-plat si absent
if (!globalThis.defineEventHandler) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.defineEventHandler = vi.fn((fn: any) => fn) as unknown as typeof globalThis.defineEventHandler
}

// Helpers H3/Nitro minimaux si absents
if (!globalThis.readBody) globalThis.readBody = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).getRouterParam) (globalThis as any).getRouterParam = vi.fn((event: any, name: string) => event?.context?.params?.[name])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).getRouterParams) (globalThis as any).getRouterParams = vi.fn((event: any) => event?.context?.params ?? {})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).getHeader) (globalThis as any).getHeader = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).setHeader) (globalThis as any).setHeader = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).getCookie) (globalThis as any).getCookie = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).setCookie) (globalThis as any).setCookie = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).deleteCookie) (globalThis as any).deleteCookie = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).getRequestURL) (globalThis as any).getRequestURL = vi.fn(() => new URL('http://localhost:3000'))

export {}
