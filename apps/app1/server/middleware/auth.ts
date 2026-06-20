// La session passe par server/utils/session-helpers (enveloppes des auto-imports nuxt-auth-utils),
// et NON par `await import('#imports')` qui plante en dev (cf. session-helpers.ts).
import { publicRoutes } from '../constants/public-routes'
import { getAuthSession, clearAuthSession } from '../utils/session-helpers'

export default defineEventHandler(async (event) => {
  const fullPath = event.path
  const path = fullPath.split('?')[0]
  const method = event.node.req.method

  // La session est scellée dans un cookie et peut survivre à la suppression du compte
  // (ex. session restée valide après un reset de base) : on vérifie que l'utilisateur existe encore.
  const sessionUserExists = async (userId: number): Promise<boolean> => {
    const found = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    return found != null
  }

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
        const session = await getAuthSession(event)
        // Sur une route publique, un utilisateur orphelin est simplement traité comme anonyme.
        event.context.user =
          session?.user && (await sessionUserExists(session.user.id)) ? session.user : null
      } catch {
        event.context.user = null
      }
    }
    return
  }

  // --- Routes API protégées ---
  if (path.startsWith('/api/')) {
    const session = await getAuthSession(event)
    if (session?.user) {
      // Session orpheline (utilisateur supprimé) : on l'invalide et on force la reconnexion
      // plutôt que de laisser les handlers renvoyer un 404 « Utilisateur introuvable » déroutant.
      if (!(await sessionUserExists(session.user.id))) {
        await clearAuthSession(event)
        throw createError({ status: 401, message: 'Session invalide, veuillez vous reconnecter' })
      }
      event.context.user = session.user
      return
    }
    throw createError({ status: 401, message: 'Unauthorized' })
  }

  // Routes de pages — gérées par le middleware client (auth.client.ts)
})
