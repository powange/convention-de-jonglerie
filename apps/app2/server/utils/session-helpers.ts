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
