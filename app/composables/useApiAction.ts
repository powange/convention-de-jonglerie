import { ref, readonly, type Ref } from 'vue'

/**
 * Structure d'erreur API normalisée
 */
export interface ApiError {
  statusCode: number
  status?: number
  message?: string
  data?: {
    message?: string
    errors?: Record<string, string>
    [key: string]: unknown
  }
}

/**
 * Configuration des messages d'erreur par code HTTP
 */
export interface ErrorMessages {
  /** Message par défaut si aucun code spécifique */
  default?: string
  /** Messages par code HTTP */
  [statusCode: number]: string
}

/**
 * Options pour une action API
 */
export interface ApiActionOptions<TData = unknown, TResult = unknown> {
  /** Méthode HTTP (défaut: 'POST') */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

  /** Corps de la requête - peut être une fonction pour données dynamiques */
  body?: TData | (() => TData)

  /** Paramètres de requête */
  query?: Record<string, unknown> | (() => Record<string, unknown>)

  /** Messages toast en cas de succès */
  successMessage?: {
    title: string
    description?: string
  }

  /** Messages d'erreur par code HTTP ou message par défaut */
  errorMessages?: ErrorMessages

  /** Désactiver complètement les toasts (succès et erreur) */
  silent?: boolean

  /** Désactiver uniquement le toast de succès */
  silentSuccess?: boolean

  /** Désactiver uniquement le toast d'erreur */
  silentError?: boolean

  /** Action après succès */
  onSuccess?: (result: TResult) => void | Promise<void>

  /** Action après erreur */
  onError?: (error: ApiError) => void | Promise<void>

  /** Redirection après succès */
  redirectOnSuccess?: string | ((result: TResult) => string)

  /** Redirection conditionnelle après erreur (par code HTTP) */
  redirectOnError?: {
    [statusCode: number]: string | ((error: ApiError) => string)
  }

  /** Fonction de refresh à appeler après succès */
  refreshOnSuccess?: () => void | Promise<void>

  /** Émettre un événement après succès (pour composants) */
  emitOnSuccess?: () => void
}

/**
 * Retour de useApiAction pour une action simple
 */
export interface ApiActionReturn<TResult = unknown> {
  /** État de chargement */
  loading: Readonly<Ref<boolean>>

  /** Dernière erreur survenue */
  error: Readonly<Ref<ApiError | null>>

  /** Dernier résultat de l'appel */
  data: Readonly<Ref<TResult | null>>

  /** Exécuter l'action */
  execute: () => Promise<TResult | null>

  /** Réinitialiser l'état */
  reset: () => void
}

/**
 * Retour de useApiActionById pour actions multiples (par ID)
 */
export interface ApiActionByIdReturn<TResult = unknown> {
  /** ID en cours de traitement (null si aucun) */
  loadingId: Readonly<Ref<string | number | null>>

  /** Vérifie si un ID spécifique est en chargement */
  isLoading: (id: string | number) => boolean

  /** Dernière erreur survenue */
  error: Readonly<Ref<ApiError | null>>

  /** Exécuter l'action pour un ID spécifique */
  execute: (id: string | number) => Promise<TResult | null>

  /** Réinitialiser l'état */
  reset: () => void
}

/**
 * Détecte le format createSuccessResponse et extrait data.
 * Format détecté : { success: true, data: T, message?: string }
 * où TOUTES les clés sont dans ['success', 'data', 'message'].
 */
function unwrapApiResponse<T>(result: T): T {
  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    'success' in result &&
    'data' in result &&
    (result as Record<string, unknown>).success === true &&
    Object.keys(result).every((k) => ['success', 'data', 'message'].includes(k))
  ) {
    return (result as Record<string, unknown>).data as T
  }
  return result
}

/**
 * Normalise une erreur capturée en ApiError
 */
function normalizeError(e: unknown): ApiError {
  const err = e as Record<string, unknown>
  return {
    statusCode: (err.statusCode as number) || (err.status as number) || 500,
    status: err.status as number | undefined,
    message: err.message as string | undefined,
    data: err.data as ApiError['data'],
  }
}

/**
 * Résout le message d'erreur selon le code HTTP
 * Fonction utilitaire partagée entre useApiAction et useApiActionById
 */
function createErrorMessageResolver(
  errorMessages: ErrorMessages,
  t: (key: string) => string
): (apiError: ApiError) => string {
  return (apiError: ApiError): string => {
    const code = apiError.statusCode || apiError.status || 500

    // Message spécifique au code HTTP fourni
    if (errorMessages[code]) {
      return errorMessages[code]
    }

    // Message par défaut fourni
    if (errorMessages.default) {
      return errorMessages.default
    }

    // Message de l'API s'il existe
    if (apiError.data?.message) {
      return apiError.data.message
    }
    if (apiError.message) {
      return apiError.message
    }

    // Messages par défaut selon le code HTTP
    const defaultMessages: Record<number, string> = {
      400: t('errors.invalid_request'),
      401: t('errors.invalid_credentials'),
      403: t('errors.access_denied'),
      404: t('common.not_found'),
      409: t('errors.conflict'),
      422: t('errors.validation_error'),
      500: t('errors.server_error'),
    }

    return defaultMessages[code] || t('errors.generic')
  }
}

/**
 * Composable pour centraliser les appels API avec gestion du loading et des erreurs
 *
 * @example Cas simple - POST avec toast
 * ```typescript
 * const { execute, loading } = useApiAction('/api/users', {
 *   method: 'POST',
 *   body: () => formData,
 *   successMessage: { title: t('user.created') },
 *   errorMessages: {
 *     409: t('errors.email_taken'),
 *     default: t('errors.generic')
 *   }
 * })
 * ```
 *
 * @example Avec redirection
 * ```typescript
 * const { execute, loading } = useApiAction('/api/auth/login', {
 *   method: 'POST',
 *   body: credentials,
 *   redirectOnSuccess: '/',
 *   redirectOnError: {
 *     403: '/verify-email'
 *   }
 * })
 * ```
 *
 * @example Action silencieuse (sans toast)
 * ```typescript
 * const { execute } = useApiAction('/api/analytics/track', {
 *   method: 'POST',
 *   body: { page: route.path },
 *   silent: true
 * })
 * ```
 */
export function useApiAction<TData = unknown, TResult = unknown>(
  endpoint: string | (() => string),
  options: ApiActionOptions<TData, TResult> = {}
): ApiActionReturn<TResult> {
  const toast = useToast()
  const { t } = useI18n()

  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  const data = ref<TResult | null>(null) as Ref<TResult | null>

  const {
    method = 'POST',
    body,
    query,
    successMessage,
    errorMessages = {},
    silent = false,
    silentSuccess = false,
    silentError = false,
    onSuccess,
    onError,
    redirectOnSuccess,
    redirectOnError,
    refreshOnSuccess,
    emitOnSuccess,
  } = options

  const resolveErrorMessage = createErrorMessageResolver(errorMessages, t)

  /**
   * Exécute l'appel API
   */
  const execute = async (): Promise<TResult | null> => {
    loading.value = true
    error.value = null

    try {
      const url = typeof endpoint === 'function' ? endpoint() : endpoint
      const requestBody = typeof body === 'function' ? (body as () => TData)() : body
      const requestQuery = typeof query === 'function' ? query() : query

      const result = await $fetch<TResult>(url, {
        method,
        body: requestBody as Record<string, unknown> | undefined,
        query: requestQuery,
      })

      const unwrapped = unwrapApiResponse(result)
      data.value = unwrapped

      // Toast de succès
      if (!silent && !silentSuccess && successMessage) {
        toast.add({
          title: successMessage.title,
          description: successMessage.description,
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
      }

      // Actions post-succès
      if (emitOnSuccess) emitOnSuccess()
      if (refreshOnSuccess) await refreshOnSuccess()
      if (onSuccess) await onSuccess(unwrapped)

      // Redirection
      if (redirectOnSuccess) {
        const destination =
          typeof redirectOnSuccess === 'function' ? redirectOnSuccess(unwrapped) : redirectOnSuccess
        await navigateTo(destination)
      }

      return unwrapped
    } catch (e: unknown) {
      const apiError = normalizeError(e)
      error.value = apiError

      // Toast d'erreur
      if (!silent && !silentError) {
        toast.add({
          title: resolveErrorMessage(apiError),
          icon: 'i-heroicons-x-circle',
          color: 'error',
        })
      }

      // Callback d'erreur
      if (onError) await onError(apiError)

      // Redirection sur erreur
      if (redirectOnError) {
        const code = apiError.statusCode || apiError.status || 500
        const redirectConfig = redirectOnError[code]
        if (redirectConfig) {
          const destination =
            typeof redirectConfig === 'function' ? redirectConfig(apiError) : redirectConfig
          await navigateTo(destination)
        }
      }

      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Réinitialise l'état du composable
   */
  const reset = () => {
    loading.value = false
    error.value = null
    data.value = null
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    data: readonly(data) as Readonly<Ref<TResult | null>>,
    execute,
    reset,
  }
}

/**
 * Version pour actions sur des éléments identifiés (liste avec delete/update par ID)
 *
 * @example Suppression par ID dans une liste
 * ```typescript
 * const { execute: deleteItem, loadingId, isLoading } = useApiActionById(
 *   (id) => `/api/items/${id}`,
 *   {
 *     method: 'DELETE',
 *     successMessage: { title: t('item.deleted') },
 *     refreshOnSuccess: () => refresh()
 *   }
 * )
 *
 * // Dans le template
 * // <UButton :loading="isLoading(item.id)" @click="deleteItem(item.id)" />
 * ```
 */
/**
 * Options spécifiques pour useApiActionById
 */
export interface ApiActionByIdOptions<TResult = unknown> extends Omit<
  ApiActionOptions<unknown, TResult>,
  'body' | 'onSuccess'
> {
  /** Corps de la requête (optionnel) */
  body?: unknown | ((id: string | number) => unknown)

  /** Action après succès - reçoit le résultat ET l'ID traité */
  onSuccess?: (result: TResult, id: string | number) => void | Promise<void>
}

export function useApiActionById<TResult = unknown>(
  endpointFactory: (id: string | number) => string,
  options: ApiActionByIdOptions<TResult> = {}
): ApiActionByIdReturn<TResult> {
  const toast = useToast()
  const { t } = useI18n()

  const loadingId = ref<string | number | null>(null)
  const error = ref<ApiError | null>(null)

  const {
    method = 'DELETE',
    body,
    query,
    successMessage,
    errorMessages = {},
    silent = false,
    silentSuccess = false,
    silentError = false,
    onSuccess,
    onError,
    redirectOnSuccess,
    redirectOnError,
    refreshOnSuccess,
    emitOnSuccess,
  } = options

  /**
   * Vérifie si un ID spécifique est en cours de chargement
   */
  const isLoading = (id: string | number): boolean => {
    return loadingId.value === id
  }

  const resolveErrorMessage = createErrorMessageResolver(errorMessages, t)

  /**
   * Exécute l'action pour un ID spécifique
   */
  const execute = async (id: string | number): Promise<TResult | null> => {
    loadingId.value = id
    error.value = null

    try {
      const url = endpointFactory(id)
      const requestBody = typeof body === 'function' ? body(id) : body
      const requestQuery = typeof query === 'function' ? query() : query

      const result = await $fetch<TResult>(url, {
        method,
        body: requestBody as Record<string, unknown> | undefined,
        query: requestQuery,
      })

      // Unwrap createSuccessResponse avant tout traitement
      const unwrapped = unwrapApiResponse(result)

      // Toast de succès
      if (!silent && !silentSuccess && successMessage) {
        toast.add({
          title: successMessage.title,
          description: successMessage.description,
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
      }

      // Actions post-succès (on passe l'ID à la callback)
      if (emitOnSuccess) emitOnSuccess()
      if (refreshOnSuccess) await refreshOnSuccess()
      if (onSuccess) await onSuccess(unwrapped, id)

      // Redirection
      if (redirectOnSuccess) {
        const destination =
          typeof redirectOnSuccess === 'function' ? redirectOnSuccess(unwrapped) : redirectOnSuccess
        await navigateTo(destination)
      }

      return unwrapped
    } catch (e: unknown) {
      const apiError = normalizeError(e)
      error.value = apiError

      // Toast d'erreur
      if (!silent && !silentError) {
        toast.add({
          title: resolveErrorMessage(apiError),
          icon: 'i-heroicons-x-circle',
          color: 'error',
        })
      }

      // Callback d'erreur
      if (onError) await onError(apiError)

      // Redirection sur erreur
      if (redirectOnError) {
        const code = apiError.statusCode || apiError.status || 500
        const redirectConfig = redirectOnError[code]
        if (redirectConfig) {
          const destination =
            typeof redirectConfig === 'function' ? redirectConfig(apiError) : redirectConfig
          await navigateTo(destination)
        }
      }

      return null
    } finally {
      loadingId.value = null
    }
  }

  /**
   * Réinitialise l'état du composable
   */
  const reset = () => {
    loadingId.value = null
    error.value = null
  }

  return {
    loadingId: readonly(loadingId),
    isLoading,
    error: readonly(error),
    execute,
    reset,
  }
}
