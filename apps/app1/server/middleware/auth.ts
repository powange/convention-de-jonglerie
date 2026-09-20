// La session passe par server/utils/session-helpers (enveloppes des auto-imports nuxt-auth-utils),
// et NON par `await import('#imports')` qui plante en dev (cf. session-helpers.ts).
import { trouverRoutePublique } from '../constants/public-routes'
import { getAuthSession, clearAuthSession } from '../utils/session-helpers'

export default defineEventHandler(async (event) => {
  const fullPath = event.path
  // `split` rend `string | undefined` pour TypeScript, alors qu'il rend toujours au moins un
  // élément. Le repli sur le chemin complet dit la même chose qu'un `!`, sans affirmer au
  // compilateur ce qu'il ne peut pas vérifier.
  const path = fullPath.split('?')[0] ?? fullPath
  const method = event.node.req.method

  /**
   * La session est-elle encore recevable, du point de vue du COMPTE ?
   *
   * Deux questions en une seule requête — celle qui était déjà faite ici :
   *
   * 1. l'utilisateur existe-t-il encore ? Une session scellée survit à la suppression du compte,
   *    par exemple après une remise à zéro de la base ;
   * 2. porte-t-elle la génération courante ? Les sessions vivent dans un cookie et n'ont aucune
   *    trace en base : sans ce numéro, rien ne permettait d'en fermer une à distance. Changer
   *    son mot de passe ne fermait que la session courante, et les autres appareils restaient
   *    connectés — indéfiniment depuis que les sessions glissent.
   *
   * Une session d'avant cette correction ne porte pas de numéro : elle est lue comme la
   * génération zéro, celle des comptes dont le mot de passe n'a jamais changé depuis. Elle
   * reste donc acceptée, et se fermera au premier changement de mot de passe.
   */
  const sessionRecevable = async (session: { user: { id: number } }): Promise<boolean> => {
    const compte = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, sessionVersion: true },
    })
    if (compte == null) return false
    const portee = Number((session as { sessionVersion?: unknown }).sessionVersion ?? 0)
    return compte.sessionVersion === portee
  }

  // Chercher une route publique correspondante. La règle vit dans `public-routes.ts`, où elle
  // est testable — ici, elle serait hors de portée d'un test.
  const matchedRoute = trouverRoutePublique(path, method)

  if (matchedRoute) {
    // Hydrater la session si demandé (routes publiques avec contenu conditionnel)
    if ('hydrateSession' in matchedRoute && matchedRoute.hydrateSession) {
      try {
        const session = await getAuthSession(event)
        // Sur une route publique, un utilisateur orphelin est simplement traité comme anonyme.
        event.context.user =
          session?.user && (await sessionRecevable(session)) ? session.user : null
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
      // Session orpheline (compte supprimé) ou périmée (mot de passe changé depuis) : on
      // l'invalide et on force la reconnexion plutôt que de laisser les handlers renvoyer un
      // 404 « Utilisateur introuvable » déroutant.
      if (!(await sessionRecevable(session))) {
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
