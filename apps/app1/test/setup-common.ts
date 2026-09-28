import { vi } from 'vitest'

// Fallbacks globaux partagés entre suites de tests.
// Chaque suite peut surcharger ces valeurs ensuite.

// Mock Prisma comme auto-import global (similaire aux autres utils Nitro)
if (!(globalThis as any).prisma) {
  const { prismaMock } = await import('./__mocks__/prisma')
  ;(globalThis as any).prisma = prismaMock
}

// defineEventHandler passe-plat si absent
if (!globalThis.defineEventHandler) {
  globalThis.defineEventHandler = vi.fn(
    (fn: any) => fn
  ) as unknown as typeof globalThis.defineEventHandler
}

// Helpers H3/Nitro minimaux si absents
if (!globalThis.readBody) globalThis.readBody = vi.fn()

if (!(globalThis as any).getRouterParam)
  (globalThis as any).getRouterParam = vi.fn(
    (event: any, name: string) => event?.context?.params?.[name]
  )

if (!(globalThis as any).getRouterParams)
  (globalThis as any).getRouterParams = vi.fn((event: any) => event?.context?.params ?? {})

// `checkAdminMode` lit `getQuery(event).adminMode` en dernier recours : sans ce repli, tout code
// qui traverse la vérification du mode admin échoue sur « getQuery is not defined » au lieu de
// rendre son verdict. Un objet vide, donc, et non `undefined` : c'est une requête sans paramètre.
if (!(globalThis as any).getQuery)
  (globalThis as any).getQuery = vi.fn((event: any) => event?.context?.query ?? {})

if (!(globalThis as any).getHeader) (globalThis as any).getHeader = vi.fn()

if (!(globalThis as any).setHeader) (globalThis as any).setHeader = vi.fn()

if (!(globalThis as any).getCookie) (globalThis as any).getCookie = vi.fn()

if (!(globalThis as any).setCookie) (globalThis as any).setCookie = vi.fn()

if (!(globalThis as any).deleteCookie) (globalThis as any).deleteCookie = vi.fn()

if (!(globalThis as any).getRequestURL)
  (globalThis as any).getRequestURL = vi.fn(() => new URL('http://localhost:3000'))

export {}
