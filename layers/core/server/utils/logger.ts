/**
 * Logger structuré pour le serveur
 *
 * Permet de gérer les logs avec différents niveaux et préfixes.
 * Le niveau de log est configurable via la variable d'environnement LOG_LEVEL.
 *
 * Niveaux disponibles (du plus verbeux au moins verbeux):
 * - debug: Logs de débogage détaillés
 * - info: Informations générales (défaut)
 * - warn: Avertissements
 * - error: Erreurs uniquement
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Récupère le niveau de log configuré
 */
function getConfiguredLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel
  }
  // Par défaut: info en production, debug en développement
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

/**
 * Vérifie si un niveau de log doit être affiché
 */
function shouldLog(level: LogLevel): boolean {
  const configuredLevel = getConfiguredLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel]
}

/**
 * Formate un timestamp pour les logs
 */
function formatTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Formate les données additionnelles pour l'affichage
 */
function formatData(data?: unknown): string {
  if (data === undefined) return ''
  if (typeof data === 'string') return ` ${data}`
  try {
    return ` ${JSON.stringify(data)}`
  } catch {
    return ` [Object non sérialisable]`
  }
}

/**
 * Crée un logger avec un préfixe spécifique
 *
 * @example
 * const log = createLogger('AGENT')
 * log.info('Démarrage de l\'exploration')
 * log.debug('URL visitée', { url: 'https://...' })
 * log.error('Échec du fetch', error)
 */
export function createLogger(prefix: string) {
  const formattedPrefix = `[${prefix}]`

  return {
    debug: (message: string, data?: unknown) => {
      if (shouldLog('debug')) {
        console.log(`${formatTimestamp()} DEBUG ${formattedPrefix} ${message}${formatData(data)}`)
      }
    },

    info: (message: string, data?: unknown) => {
      if (shouldLog('info')) {
        console.log(`${formatTimestamp()} INFO ${formattedPrefix} ${message}${formatData(data)}`)
      }
    },

    warn: (message: string, data?: unknown) => {
      if (shouldLog('warn')) {
        console.warn(`${formatTimestamp()} WARN ${formattedPrefix} ${message}${formatData(data)}`)
      }
    },

    error: (message: string, data?: unknown) => {
      if (shouldLog('error')) {
        console.error(`${formatTimestamp()} ERROR ${formattedPrefix} ${message}${formatData(data)}`)
      }
    },
  }
}

/**
 * Logger par défaut pour les modules sans préfixe spécifique
 */
export const logger = createLogger('APP')

/**
 * Loggers pré-configurés pour les modules courants
 */
export const loggers = {
  agent: createLogger('AGENT'),
  llm: createLogger('LLM'),
  scraper: createLogger('SCRAPER'),
  import: createLogger('IMPORT'),
  aiConfig: createLogger('AI-CONFIG'),
  cache: createLogger('CACHE'),
}
