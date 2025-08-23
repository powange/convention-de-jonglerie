export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false,
  // Optimisations pour le lazy loading
  lazy: true,
  // Ne pas précharger toutes les locales
  precompiledMessages: false,
  // Charger uniquement la locale active
  messages: {},
}))
