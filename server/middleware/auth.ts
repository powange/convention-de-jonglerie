// Note: on charge getUserSession dynamiquement pour faciliter le mocking dans les tests

import { publicRoutes } from '../constants/public-routes'

export default defineEventHandler(async (event) => {
  const imports: any = await import('#imports')
  const getUserSession = imports.getUserSession
  const fullPath = event.path
  const path = fullPath.split('?')[0]
  const method = event.node.req.method

  // Chercher une route publique correspondante
  const matchedRoute = publicRoutes.find((route) => {
    if (!method || !route.methods.includes(method)) return false
    if ('prefix' in route) return path.startsWith(route.prefix)
    if ('pattern' in route) return route.pattern.test(path)
    return route.path === path
  })

  if (matchedRoute) {
    // Hydrater la session si demandé (routes publiques avec contenu conditionnel)
    if ('hydrateSession' in matchedRoute && matchedRoute.hydrateSession) {
      try {
        const session = await getUserSession(event)
        event.context.user = session?.user || null
      } catch {
        event.context.user = null
      }
    }
    return
  }

  // --- Routes API protégées ---
  if (path.startsWith('/api/')) {
    const session = await getUserSession(event)
    if (session?.user) {
      event.context.user = session.user
      return
    }
    throw createError({ status: 401, message: 'Unauthorized' })
  }

  // Routes de pages — gérées par le middleware client (auth.client.ts)
})
