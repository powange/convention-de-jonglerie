/**
 * Interface pour les erreurs HTTP Nuxt/Nitro
 */
export interface HttpError extends Error {
  statusCode?: number
  statusMessage?: string
  data?: {
    message?: string
    [key: string]: any
  }
}

/**
 * Options pour la gestion d'erreur
 */
export interface ErrorHandlerOptions {
  /** Clé i18n pour le titre par défaut */
  defaultTitleKey: string
  /** Clé i18n pour le message d'erreur générique */
  genericErrorKey?: string
  /** Logger les erreurs dans la console */
  logError?: boolean
  /** Préfixe pour les logs */
  logPrefix?: string
}

/**
 * Formate une erreur HTTP pour l'affichage dans un toast
 *
 * @param error - L'erreur à formater (peut être de n'importe quel type)
 * @param t - Fonction de traduction i18n
 * @param options - Options de configuration
 * @returns Objet contenant le titre et la description formatés
 *
 * @example
 * ```typescript
 * try {
 *   await $fetch('/api/endpoint')
 * } catch (error) {
 *   const { title, description } = formatHttpError(error, t, {
 *     defaultTitleKey: 'errors.operation_failed'
 *   })
 *   toast.add({ title, description, color: 'error' })
 * }
 * ```
 */
export function formatHttpError(
  error: unknown,
  t: (key: string) => string,
  options: ErrorHandlerOptions
): { title: string; description: string } {
  const {
    defaultTitleKey,
    genericErrorKey = 'errors.server_error',
    logError = true,
    logPrefix = 'Error',
  } = options

  // Logger l'erreur si demandé
  if (logError) {
    console.error(`${logPrefix}:`, error)
  }

  // Cast en HttpError pour accéder aux propriétés
  const httpError = error as HttpError

  // Extraire le message d'erreur
  const description = httpError.data?.message || httpError.message || t(genericErrorKey)

  return {
    title: t(defaultTitleKey),
    description,
  }
}

/**
 * Composable pour faciliter la gestion d'erreur avec toast
 *
 * @returns Fonction handleError configurée avec toast et i18n
 *
 * @example
 * ```typescript
 * const { handleError } = useErrorHandler()
 *
 * try {
 *   await $fetch('/api/endpoint')
 * } catch (error) {
 *   handleError(error, {
 *     defaultTitleKey: 'errors.operation_failed',
 *     showToast: true
 *   })
 * }
 * ```
 */
export function useErrorHandler() {
  const toast = useToast()
  const { t } = useI18n()

  /**
   * Gère une erreur et affiche un toast si demandé
   */
  const handleError = (
    error: unknown,
    options: ErrorHandlerOptions & { showToast?: boolean } = {
      defaultTitleKey: 'errors.error_occurred',
      showToast: true,
    }
  ) => {
    const { title, description } = formatHttpError(error, t, options)

    if (options.showToast !== false) {
      toast.add({
        title,
        description,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }

    return { title, description }
  }

  return { handleError }
}
