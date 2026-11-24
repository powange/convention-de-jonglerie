import type { H3Event } from 'h3'

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

/**
 * Ouvre la session après une authentification réussie — même signature que dans app1, parce que le
 * layer d'auth partagé (`layers/auth`) l'appelle sous ce nom (Google, Facebook, vérification
 * d'adresse, invitation, définition du mot de passe). Son absence empêchait app2 de se construire.
 *
 * ⚠️ VERSION SIMPLIFIÉE, délibérément. Dans app1, `ouvrirSession` porte une session glissante
 * (échéance, plafond absolu, génération comparée par un middleware à chaque requête). App2 n'a pas
 * ce middleware : écrire ces champs ici ferait croire à une protection qui n'existe pas. On garde
 * donc la durée fixe de `runtimeConfig.session.maxAge`, et `seSouvenirDeMoi` est sans effet.
 */
export function ouvrirSession(
  event: H3Event,
  data: Parameters<typeof setUserSession>[1],
  _options: { seSouvenirDeMoi?: boolean; sessionVersion?: number } = {}
) {
  return setUserSession(event, data)
}
