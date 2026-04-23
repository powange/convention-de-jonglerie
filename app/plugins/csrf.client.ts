/**
 * Plugin CSRF client.
 *
 * Intercepte toutes les requêtes `$fetch` (et `useFetch` qui s'appuie dessus)
 * pour injecter automatiquement le header `x-csrf-token` à partir du cookie
 * `csrf_token` set par le middleware serveur.
 *
 * Pattern : Double Submit Cookie. Un site malveillant ne peut pas lire le cookie
 * (Same-Origin Policy), donc ne peut pas reproduire le bon header → la requête
 * cross-origin est rejetée par le serveur.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'csrf_token'

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default defineNuxtPlugin((nuxtApp) => {
  // onRequest s'exécute avant chaque appel $fetch (incluant useFetch en interne)
  nuxtApp.hook('app:created', () => {
    const originalFetch = globalThis.$fetch
    if (!originalFetch || (originalFetch as any).__csrfWrapped) return

    const wrapped = originalFetch.create({
      onRequest({ options }) {
        const method = (options.method || 'GET').toString().toUpperCase()
        if (SAFE_METHODS.has(method)) return

        const token = readCsrfCookie()
        if (!token) return

        // Compatibilité avec différentes formes de Headers
        const headers = new Headers(options.headers as HeadersInit)
        if (!headers.has(CSRF_HEADER)) {
          headers.set(CSRF_HEADER, token)
        }
        options.headers = headers
      },
    })
    ;(wrapped as any).__csrfWrapped = true
    globalThis.$fetch = wrapped as typeof globalThis.$fetch
  })
})
