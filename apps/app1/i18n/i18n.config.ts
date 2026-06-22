// --- Remontée des clés de traduction manquantes vers l'API ---
// Quand vue-i18n ne trouve pas une clé, on l'envoie (côté client) à /api/i18n/missing-keys qui la
// journalise dans ApiErrorLog → historique consultable dans /admin/error-logs. Best-effort :
// dédupliqué et batché en mémoire, n'altère jamais le rendu (la clé reste affichée en fallback).
const reportedMissingKeys = new Set<string>()
let pendingMissingKeys: { key: string; locale: string }[] = []
let missingFlushTimer: ReturnType<typeof setTimeout> | null = null

function flushMissingKeys() {
  missingFlushTimer = null
  if (pendingMissingKeys.length === 0) return
  const keys = pendingMissingKeys.slice(0, 50)
  pendingMissingKeys = []
  const path = typeof window !== 'undefined' ? window.location.pathname : undefined
  const fetcher = (globalThis as { $fetch?: (url: string, opts: unknown) => Promise<unknown> })
    .$fetch
  if (!fetcher) return
  fetcher('/api/i18n/missing-keys', { method: 'POST', body: { keys, path } }).catch(() => {})
}

function reportMissingKey(locale: string, key: string) {
  // Uniquement côté client ; on ignore les clés vides ou déjà signalées dans cette session.
  if (!import.meta.client || !key || typeof key !== 'string') return
  if (reportedMissingKeys.size > 2000) return // garde-fou mémoire
  const dedup = `${locale}:${key}`
  if (reportedMissingKeys.has(dedup)) return
  reportedMissingKeys.add(dedup)
  pendingMissingKeys.push({ key, locale })
  if (!missingFlushTimer) missingFlushTimer = setTimeout(flushMissingKeys, 3000)
}

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false,
  // Handler appelé par vue-i18n quand une clé est absente : on la journalise côté serveur.
  // (retour `undefined` → comportement d'affichage inchangé : la clé est rendue telle quelle)
  missing: (locale: string, key: string) => {
    reportMissingKey(locale, String(key))
  },
  // Optimisations pour le lazy loading
  lazy: true,
  // Ne pas précharger toutes les locales
  precompiledMessages: false,
  // Charger uniquement la locale active
  messages: {},
}))
