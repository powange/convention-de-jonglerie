import type { PublicApiEndpointKey } from '#server/utils/public-api-endpoints'
import type { EventHandlerRequest, H3Event } from 'h3'

/**
 * Authentification par token d'API pour les endpoints publics.
 *
 * Les tokens sont gérés depuis l'administration (/admin/api-tokens). Chaque token
 * peut être restreint à un sous-ensemble d'endpoints publics via son champ `scopes` :
 *   - `scopes` null → accès à TOUS les endpoints (rétrocompatibilité) ;
 *   - `scopes` = tableau de clés → accès uniquement aux endpoints listés.
 *
 * Le token peut être fourni de deux façons :
 *   - en query param : `?token=<token>` (rétrocompatible)
 *   - en en-tête : `Authorization: Bearer <token>`
 *
 * @param event - L'événement H3
 * @param endpointKey - La clé de l'endpoint appelant (cf. PUBLIC_API_ENDPOINTS)
 * @returns Le token d'API validé (id, name)
 * @throws 401 si le token est absent, inconnu ou révoqué ; 403 s'il n'a pas le droit sur cet endpoint
 */
export async function requireApiToken(
  event: H3Event<EventHandlerRequest>,
  endpointKey: PublicApiEndpointKey
) {
  const token = extractApiToken(event)

  if (!token) {
    throw createError({ status: 401, message: 'Token requis' })
  }

  const apiToken = await prisma.apiToken.findUnique({
    where: { token },
    select: { id: true, name: true, isActive: true, scopes: true },
  })

  if (!apiToken || !apiToken.isActive) {
    throw createError({ status: 401, message: 'Token invalide' })
  }

  if (!tokenHasScope(apiToken.scopes, endpointKey)) {
    throw createError({ status: 403, message: "Ce token n'a pas accès à cet endpoint" })
  }

  // Tracer l'utilisation du token (sans bloquer la réponse en cas d'échec)
  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() },
  })

  return { id: apiToken.id, name: apiToken.name }
}

/**
 * Vérifie qu'un token (via son champ `scopes` brut issu de la base) a le droit
 * d'accéder à l'endpoint demandé.
 *   - `null`/absent → accès à tous les endpoints (rétrocompatibilité) ;
 *   - tableau → l'endpoint doit y figurer.
 */
function tokenHasScope(scopes: unknown, endpointKey: PublicApiEndpointKey): boolean {
  if (scopes === null || scopes === undefined) return true
  if (!Array.isArray(scopes)) return false
  return scopes.includes(endpointKey)
}

/**
 * Récupère le token brut depuis la requête : query param `token` ou
 * en-tête `Authorization: Bearer <token>`.
 */
function extractApiToken(event: H3Event<EventHandlerRequest>): string | null {
  const { token } = getQuery(event)
  if (typeof token === 'string' && token.length > 0) {
    return token
  }

  const authorization = getHeader(event, 'authorization')
  if (authorization?.startsWith('Bearer ')) {
    const bearer = authorization.slice('Bearer '.length).trim()
    if (bearer.length > 0) return bearer
  }

  return null
}
