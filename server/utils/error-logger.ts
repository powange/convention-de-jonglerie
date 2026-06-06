import { getHeaders, getHeader } from 'h3'

import { firebaseAdmin } from './firebase-admin'
import { unifiedPushService } from './unified-push-service'

import type { H3Event } from 'h3'

interface ErrorInfo {
  error: Error
  statusCode: number
  event: H3Event
}

// Anti-spam: cooldown par signature d'erreur pour les alertes admin (en mémoire, par worker)
const ADMIN_ALERT_COOLDOWN_MS = Number(process.env.ERROR_ALERT_COOLDOWN_MS) || 5 * 60 * 1000
const lastAdminAlertAt = new Map<string, number>()

/**
 * Détermine si une nouvelle alerte admin doit être envoyée pour cette signature
 * d'erreur (limite le flood quand la même erreur se répète rapidement).
 */
function shouldAlertAdmins(signature: string): boolean {
  const now = Date.now()
  const last = lastAdminAlertAt.get(signature)
  if (last && now - last < ADMIN_ALERT_COOLDOWN_MS) {
    return false
  }
  lastAdminAlertAt.set(signature, now)
  // Nettoyage basique pour éviter une croissance illimitée de la map
  if (lastAdminAlertAt.size > 500) {
    for (const [key, ts] of lastAdminAlertAt) {
      if (now - ts > ADMIN_ALERT_COOLDOWN_MS) lastAdminAlertAt.delete(key)
    }
  }
  return true
}

/**
 * Envoie une notification push aux admins globaux en cas d'erreur serveur (>= 500).
 *
 * Important: ces alertes ne sont PAS enregistrées dans le système de notifications
 * du site (table Notification). Ce sont de simples push FCM destinées à prévenir
 * les admins en temps réel d'une erreur serveur.
 */
async function alertAdminsOfServerError(params: {
  message: string
  errorType: string
  statusCode: number
  method: string
  path: string
}): Promise<void> {
  try {
    // Pas de FCM configuré → rien à faire (évite des requêtes DB inutiles)
    if (!firebaseAdmin.isInitialized()) return

    // Anti-spam: une alerte par (méthode + path + type d'erreur) toutes les N minutes
    const signature = `${params.method} ${params.path} ${params.errorType}`
    if (!shouldAlertAdmins(signature)) return

    const admins = await prisma.user.findMany({
      where: { isGlobalAdmin: true },
      select: { id: true },
    })
    if (admins.length === 0) return

    const shortMessage =
      params.message.length > 150 ? `${params.message.slice(0, 147)}...` : params.message

    await unifiedPushService.sendToUsers(
      admins.map((a) => a.id),
      {
        title: `🚨 Erreur ${params.statusCode} — ${params.method} ${params.path}`,
        message: shortMessage,
        url: '/admin/error-logs',
        type: 'error',
      }
    )
  } catch (alertError) {
    // Ne jamais faire échouer le logging à cause de l'alerte
    console.error('[Error alert] Échec de la notification push aux admins:', alertError)
  }
}

/**
 * Nettoie les données sensibles des headers HTTP
 */
function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, any> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-session-token',
    'x-access-token',
    'x-refresh-token',
  ]

  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '***REDACTED***'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Nettoie les données sensibles du corps de la requête
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sensitiveFields = [
    'password',
    'newPassword',
    'currentPassword',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'privateKey',
    'phone', // Numéros de téléphone sensibles
    'email', // Emails pour RGPD (on garde que le domaine)
  ]

  const sanitized: any = {}

  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveFields.includes(lowerKey)) {
      if (lowerKey === 'email' && typeof value === 'string') {
        // Garder seulement le domaine pour les emails
        const domain = value.split('@')[1]
        sanitized[key] = domain ? `***@${domain}` : '***REDACTED***'
      } else {
        sanitized[key] = '***REDACTED***'
      }
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Extrait les détails SQL d'une erreur Prisma
 */
function extractPrismaDetails(error: any): {
  code?: string
  meta?: any
  sqlMessage?: string
  sqlState?: string
} | null {
  // Pour les erreurs Prisma connues
  if (error.name === 'PrismaClientKnownRequestError') {
    return {
      code: error.code,
      meta: error.meta,
    }
  }

  // Pour les erreurs Prisma inconnues, extraire les détails MySQL/SQL si disponibles
  if (
    error.name === 'PrismaClientUnknownRequestError' ||
    error.name === 'PrismaClientInitializationError'
  ) {
    const details: any = {}

    // Extraire le code MySQL si présent
    if (error.cause?.kind?.QueryError?.Server?.MysqlError) {
      const mysqlError = error.cause.kind.QueryError.Server.MysqlError
      details.code = mysqlError.code
      details.sqlMessage = mysqlError.message
      details.sqlState = mysqlError.state
    }

    // Extraire les métadonnées si présentes
    if (error.meta) {
      details.meta = error.meta
    }

    return Object.keys(details).length > 0 ? details : null
  }

  return null
}

/**
 * Remonte la chaîne des `cause` pour récupérer l'erreur d'origine.
 *
 * Les handlers ré-émettent fréquemment une erreur 500 générique
 * (ex: « Erreur serveur ») tout en attachant l'erreur réelle via `cause`.
 * Pour les logs, on veut le message / la stack / le type de cette erreur
 * d'origine plutôt que le message générique exposé au client.
 */
function getRootError(error: any): any {
  let current = error
  const seen = new Set<any>()
  while (
    current &&
    typeof current === 'object' &&
    current.cause &&
    current.cause !== current &&
    !seen.has(current.cause)
  ) {
    seen.add(current)
    current = current.cause
  }
  return current
}

/**
 * Détermine le type d'erreur pour classification
 */
function getErrorType(error: Error): string {
  // Types d'erreur Zod
  if (error.name === 'ZodError') return 'ValidationError'

  // Types d'erreur Prisma - classification plus fine
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any
    // Classifier par code Prisma
    if (prismaError.code === 'P2002') return 'DatabaseUniqueConstraintError'
    if (prismaError.code === 'P2003') return 'DatabaseForeignKeyError'
    if (prismaError.code === 'P2025') return 'DatabaseRecordNotFoundError'
    return 'DatabaseError'
  }
  if (error.name === 'PrismaClientUnknownRequestError') {
    // Vérifier si c'est une erreur MySQL spécifique
    const errorStr = error.toString()
    if (errorStr.includes('Out of sort memory')) return 'DatabaseSortMemoryError'
    if (errorStr.includes('Deadlock')) return 'DatabaseDeadlockError'
    if (errorStr.includes('Lock wait timeout')) return 'DatabaseLockTimeoutError'
    return 'DatabaseError'
  }
  if (error.name === 'PrismaClientInitializationError') return 'DatabaseConnectionError'
  if (error.name === 'PrismaClientValidationError') return 'DatabaseValidationError'

  // Erreurs H3
  if (error.name === 'H3Error') return 'HttpError'

  // Erreurs d'authentification
  if (error.message.includes('authentifi') || error.message.includes('auth'))
    return 'AuthenticationError'
  if (error.message.includes('autoris') || error.message.includes('permission'))
    return 'AuthorizationError'

  // Erreurs réseau
  if (error.name === 'NetworkError' || error.message.includes('network')) return 'NetworkError'
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) return 'TimeoutError'

  // Erreurs de fichier
  if (error.name === 'ENOENT' || error.message.includes('file not found')) return 'FileError'

  return 'UnknownError'
}

/**
 * Nettoie la stack trace pour enlever les chemins sensibles
 */
function sanitizeStackTrace(stack?: string): string | undefined {
  if (!stack) return undefined

  // Remplacer les chemins absolus par des chemins relatifs
  return stack
    .replace(/\/root\/projets\/convention-de-jonglerie\//g, './')
    .replace(/\/home\/[^/]+\//g, '~/')
    .replace(/\/usr\/[^/]+\//g, '/usr/***/')
    .split('\n')
    .slice(0, 20) // Limiter à 20 lignes max
    .join('\n')
}

/**
 * Extrait l'IP réelle du client depuis les headers
 */
function getClientIP(event: H3Event): string | undefined {
  const headers = getHeaders(event)

  // Essayer différents headers dans l'ordre de priorité
  const ipHeaders = [
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'x-real-ip',
    'x-client-ip',
    'x-cluster-client-ip',
  ]

  for (const header of ipHeaders) {
    const ip = headers[header]
    if (ip && typeof ip === 'string') {
      // Prendre la première IP si c'est une liste séparée par des virgules
      const firstIP = ip.split(',')[0].trim()
      if (firstIP && firstIP !== '127.0.0.1' && firstIP !== '::1') {
        return firstIP
      }
    }
  }

  // Fallback sur l'IP de la requête depuis les headers
  return (
    (headers['x-forwarded-for'] as string) ||
    (headers['x-real-ip'] as string) ||
    event.node.req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * Log une erreur API dans la base de données
 */
export async function logApiError({ error, statusCode, event }: ErrorInfo): Promise<void> {
  try {
    const url = event.node.req.url || ''
    const method = event.node.req.method || 'UNKNOWN'
    const userAgent = getHeader(event, 'user-agent') || undefined
    const ip = getClientIP(event)

    // Extraire le path sans query params
    const urlObj = new URL(url, 'http://localhost')
    const path = urlObj.pathname

    // Récupérer l'utilisateur connecté si disponible
    const userId = event.context?.user?.id || null

    // Récupérer le referer (page d'origine)
    const referer = getHeader(event, 'referer') || getHeader(event, 'referrer') || undefined

    // Récupérer l'origin (domaine d'origine)
    const origin = getHeader(event, 'origin') || undefined

    // Lire le body de manière sécurisée (peut échouer)
    let body: any = null
    try {
      // Ne pas relire le body s'il a déjà été lu
      if (method !== 'GET' && method !== 'HEAD') {
        // Le body peut déjà avoir été lu par l'API
        body = event.context._body || null

        // Si le body n'est pas dans le contexte, essayer de le récupérer depuis les données brutes
        if (!body && event.node.req.readable === false) {
          // Le body a déjà été consommé, mais peut-être disponible ailleurs
          body = event.context.body || null
        }
      }
    } catch {
      // Ignorer les erreurs de lecture du body
    }

    // Remonter à l'erreur d'origine si l'erreur a été ré-emballée (via `cause`).
    // Cela évite d'enregistrer un message générique (« Erreur serveur ») à la
    // place de la vraie erreur, qui n'apparaissait jusqu'ici que dans les logs
    // du conteneur (console.error).
    const rootError = getRootError(error)
    const hasCause =
      rootError &&
      rootError !== error &&
      typeof rootError.message === 'string' &&
      rootError.message.length > 0
    const effectiveError = hasCause ? rootError : error

    // Conserver le message générique exposé au client si différent du vrai message
    const message =
      hasCause && rootError.message !== error.message
        ? `${rootError.message} (réponse: ${error.message})`
        : effectiveError.message

    // Extraire les détails Prisma/SQL si c'est une erreur de base de données
    const prismaDetails = extractPrismaDetails(effectiveError) || extractPrismaDetails(error)
    const errorType = getErrorType(effectiveError)

    // Créer l'enregistrement de log
    await prisma.apiErrorLog.create({
      data: {
        message,
        statusCode,
        stack: sanitizeStackTrace(effectiveError.stack || error.stack),
        errorType,
        method,
        url,
        path,
        userAgent,
        ip,
        referer,
        origin,
        headers: sanitizeHeaders(getHeaders(event)),
        body: body ? sanitizeBody(body) : null,
        queryParams: Object.fromEntries(urlObj.searchParams.entries()),
        prismaDetails: prismaDetails || undefined,
        userId,
      },
    })

    // Alerter les admins par push en cas d'erreur serveur (>= 500).
    // Fire-and-forget pour ne pas retarder la réponse d'erreur au client.
    if (statusCode >= 500) {
      void alertAdminsOfServerError({ message, errorType, statusCode, method, path })
    }
  } catch (logError) {
    // Ne pas faire planter l'application si le logging échoue
    console.error('Failed to log API error:', logError)

    // Log d'urgence dans la console avec les infos essentielles
    console.error('ORIGINAL API ERROR:', {
      message: error.message,
      statusCode,
      method: event.node.req.method,
      url: event.node.req.url,
      userId: event.context?.user?.id,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Wrapper pour les handlers API qui log automatiquement les erreurs
 */
export function withErrorLogging<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Vérifier si le premier argument est un H3Event
      const event = args[0] as H3Event
      if (event && event.node && event.node.req) {
        const statusCode = (error as any).statusCode || 500
        await logApiError({ error: error as Error, statusCode, event })
      }

      // Re-lancer l'erreur pour que le comportement normal continue
      throw error
    }
  }
}
