/**
 * Variante de useFetch qui déballe automatiquement l'enveloppe
 * { success: true, data: T } renvoyée par createSuccessResponse côté serveur.
 *
 * - Si la réponse contient les clés `success` et `data`, on retourne `response.data`.
 * - Sinon, on retourne la réponse telle quelle (endpoints non-wrappés).
 * - Un `transform` passé par l'appelant est chaîné APRÈS l'auto-unwrap : il
 *   reçoit donc directement le payload déballé, plus l'enveloppe brute.
 *
 * Why: éviter les `transform: (r) => r?.data?.X` répétés dans les pages SSR.
 */
function unwrapEnvelope<T>(response: unknown): T {
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'data' in response &&
    (response as { success: unknown }).success === true
  ) {
    return (response as { data: T }).data
  }
  return response as T
}

export const useApiFetch = createUseFetch((currentOptions) => {
  const userTransform = currentOptions.transform
  return {
    ...currentOptions,
    transform: userTransform
      ? (response: unknown) => userTransform(unwrapEnvelope(response))
      : unwrapEnvelope,
  }
})
