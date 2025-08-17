import { useRuntimeConfig } from '#imports'

// Retourne le secret JWT en privilégiant, dans l'ordre:
// 1) une éventuelle surcharge globale (tests) via useRuntimeConfig()
// 2) la variable d'environnement JWT_SECRET
// 3) la config Nuxt runtime (useRuntimeConfig)
// 4) un fallback de développement
export function getJwtSecret(): string {
  try {
    const globalUseRuntime = (globalThis as any).useRuntimeConfig as undefined | (() => any)
    if (typeof globalUseRuntime === 'function') {
      const cfg = globalUseRuntime()
      if (cfg?.jwtSecret) return cfg.jwtSecret
    }
  } catch {}

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 0) {
    return process.env.JWT_SECRET
  }
  try {
    // En environnement Nuxt/Nitro
    return useRuntimeConfig().jwtSecret
  } catch {}
  // Fallback ultime (dev/tests sans Nuxt)
  return 'fallback-secret-for-development'
}
