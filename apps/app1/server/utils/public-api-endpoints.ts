/**
 * Registre central des endpoints de l'API publique.
 *
 * Source unique de vérité : chaque endpoint public `/api/public/*` doit y être
 * déclaré avec une `key` stable. Cette clé sert :
 *   - côté serveur, à restreindre l'accès d'un token (voir `requireApiToken`) ;
 *   - côté admin, à proposer la liste des droits attribuables à un token.
 *
 * Le libellé affiché dans l'administration provient de l'i18n :
 *   `admin.api_tokens.endpoints.<key>`
 */
export const PUBLIC_API_ENDPOINTS = [
  {
    key: 'editions',
    method: 'GET',
    path: '/api/public/editions',
  },
  {
    key: 'error-logs',
    method: 'GET',
    path: '/api/public/error-logs',
  },
] as const

export type PublicApiEndpoint = (typeof PUBLIC_API_ENDPOINTS)[number]
export type PublicApiEndpointKey = PublicApiEndpoint['key']

/** Toutes les clés d'endpoints publics connues. */
export const PUBLIC_API_ENDPOINT_KEYS: PublicApiEndpointKey[] = PUBLIC_API_ENDPOINTS.map(
  (endpoint) => endpoint.key
)

/** Vrai si la chaîne fournie correspond à une clé d'endpoint public connue. */
export function isPublicApiEndpointKey(value: unknown): value is PublicApiEndpointKey {
  return (
    typeof value === 'string' && PUBLIC_API_ENDPOINT_KEYS.includes(value as PublicApiEndpointKey)
  )
}
