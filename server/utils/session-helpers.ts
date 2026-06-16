import type { H3Event } from 'h3'

/**
 * Fines enveloppes autour des auto-imports nuxt-auth-utils (getUserSession / clearUserSession /
 * setUserSession).
 *
 * But : permettre au code serveur d'accéder à la session SANS faire `await import('#imports')`.
 * Cet import dynamique charge le module d'auto-imports *entier* — or, en dev, Nitro génère un
 * `#imports` incohérent (il ré-exporte toutes les fonctions h3 mais n'en importe qu'une partie),
 * ce qui lève `appendCorsHeaders is not defined` au chargement et renvoie 500 sur toutes les routes.
 *
 * Ici, getUserSession/clearUserSession/setUserSession sont utilisés comme auto-imports Nitro
 * (résolus et tree-shakés à la compilation, sans matérialiser l'objet ré-export cassé), et ce
 * module reste un vrai module relatif, donc mockable proprement dans les tests via `vi.mock`.
 */

// Préfixe « Auth » pour éviter la collision avec les auto-imports h3 (getSession/clearSession),
// qui produisait des warnings « Duplicated imports » côté Nitro.
export function getAuthSession(event: H3Event) {
  return getUserSession(event)
}

export function clearAuthSession(event: H3Event) {
  return clearUserSession(event)
}

export function setAuthSession(
  event: H3Event,
  data: Parameters<typeof setUserSession>[1],
  config?: Parameters<typeof setUserSession>[2]
) {
  return setUserSession(event, data, config)
}
