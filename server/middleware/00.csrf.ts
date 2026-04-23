import { assertCsrfToken, ensureCsrfToken } from '../utils/csrf'

/**
 * Middleware CSRF (Double Submit Cookie pattern).
 *
 * - Sur toutes les requêtes : assure qu'un cookie `csrf_token` existe (et le crée si absent)
 * - Sur les requêtes mutation (POST/PUT/PATCH/DELETE) : vérifie que le header
 *   `x-csrf-token` correspond au cookie
 *
 * Routes exemptées (pas de protection CSRF requise) :
 * - GET/HEAD/OPTIONS : pas de mutation
 * - Webhooks externes (signature dédiée déjà vérifiée) : `/api/project-costs/webhook`
 * - Callbacks OAuth (GET de toute façon, mais explicite) : `/auth/google`, `/auth/facebook`
 *
 * Le préfixe `00.` du nom force ce middleware à s'exécuter avant `auth.ts`.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const CSRF_EXEMPT_PREFIXES = [
  '/api/project-costs/webhook', // Webhook Stripe (signature vérifiée par stripe.webhooks.constructEvent)
  '/auth/google', // OAuth callback (GET déjà exempté, mais on le whiteliste explicitement)
  '/auth/facebook', // OAuth callback
]

export default defineEventHandler((event) => {
  // Toujours assurer qu'un cookie CSRF existe pour le client
  ensureCsrfToken(event)

  const method = event.node.req.method || 'GET'
  if (SAFE_METHODS.has(method)) return

  const path = event.path?.split('?')[0] || ''
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  assertCsrfToken(event)
})
