import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useApiAction,
  useApiActionById,
  type ApiError,
} from '../../../app/composables/useApiAction'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock useToast
const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({
  add: mockToastAdd,
}))

// Mock useI18n
vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
}))

// Mock navigateTo
const mockNavigateTo = vi.fn()
vi.stubGlobal('navigateTo', mockNavigateTo)

describe('useApiAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialisation', () => {
    it('devrait initialiser avec les valeurs par défaut', () => {
      const { loading, error, data } = useApiAction('/api/test')

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(data.value).toBeNull()
    })
  })

  describe('execute', () => {
    it('devrait exécuter une requête POST avec succès', async () => {
      const mockResult = { id: 1, name: 'Test' }
      mockFetch.mockResolvedValueOnce(mockResult)

      const { execute, loading, data, error } = useApiAction('/api/test', {
        method: 'POST',
        body: { name: 'Test' },
      })

      const promise = execute()
      expect(loading.value).toBe(true)

      const result = await promise

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(data.value).toEqual(mockResult)
      expect(result).toEqual(mockResult)
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: { name: 'Test' },
        query: undefined,
      })
    })

    it('devrait utiliser une fonction pour le body dynamique', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const dynamicBody = () => ({ dynamic: 'data', timestamp: Date.now() })
      const { execute } = useApiAction('/api/test', {
        method: 'POST',
        body: dynamicBody,
      })

      await execute()

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: expect.objectContaining({ dynamic: 'data' }),
        query: undefined,
      })
    })

    it("devrait utiliser une fonction pour l'endpoint dynamique", async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiAction(() => '/api/items/123', {
        method: 'DELETE',
      })

      await execute()

      expect(mockFetch).toHaveBeenCalledWith('/api/items/123', expect.any(Object))
    })

    it('devrait afficher un toast de succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiAction('/api/test', {
        successMessage: {
          title: 'Succès',
          description: 'Opération réussie',
        },
      })

      await execute()

      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Succès',
        description: 'Opération réussie',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    })

    it('ne devrait pas afficher de toast avec silent: true', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiAction('/api/test', {
        successMessage: { title: 'Succès' },
        silent: true,
      })

      await execute()

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('ne devrait pas afficher de toast de succès avec silentSuccess: true', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiAction('/api/test', {
        successMessage: { title: 'Succès' },
        silentSuccess: true,
      })

      await execute()

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('devrait appeler onSuccess callback', async () => {
      const mockResult = { id: 1 }
      mockFetch.mockResolvedValueOnce(mockResult)

      const onSuccess = vi.fn()
      const { execute } = useApiAction('/api/test', {
        onSuccess,
      })

      await execute()

      expect(onSuccess).toHaveBeenCalledWith(mockResult)
    })

    it('devrait rediriger après succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiAction('/api/test', {
        redirectOnSuccess: '/success-page',
      })

      await execute()

      expect(mockNavigateTo).toHaveBeenCalledWith('/success-page')
    })

    it('devrait utiliser une fonction pour redirectOnSuccess', async () => {
      const mockResult = { id: 42 }
      mockFetch.mockResolvedValueOnce(mockResult)

      const { execute } = useApiAction('/api/test', {
        redirectOnSuccess: (result) => `/items/${result.id}`,
      })

      await execute()

      expect(mockNavigateTo).toHaveBeenCalledWith('/items/42')
    })

    it('devrait appeler refreshOnSuccess', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const refreshFn = vi.fn()
      const { execute } = useApiAction('/api/test', {
        refreshOnSuccess: refreshFn,
      })

      await execute()

      expect(refreshFn).toHaveBeenCalled()
    })

    it('devrait appeler emitOnSuccess', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const emitFn = vi.fn()
      const { execute } = useApiAction('/api/test', {
        emitOnSuccess: emitFn,
      })

      await execute()

      expect(emitFn).toHaveBeenCalled()
    })
  })

  describe('gestion des erreurs', () => {
    it('devrait gérer une erreur et afficher un toast', async () => {
      const mockError = {
        statusCode: 400,
        data: { message: 'Bad Request' },
      }
      mockFetch.mockRejectedValueOnce(mockError)

      const { execute, error, data } = useApiAction('/api/test')

      const result = await execute()

      expect(result).toBeNull()
      expect(data.value).toBeNull()
      expect(error.value).toEqual({
        statusCode: 400,
        status: undefined,
        message: undefined,
        data: { message: 'Bad Request' },
      })
      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Bad Request',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    })

    it("devrait utiliser le message d'erreur personnalisé par code HTTP", async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 409 })

      const { execute } = useApiAction('/api/test', {
        errorMessages: {
          409: 'Cet élément existe déjà',
        },
      })

      await execute()

      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Cet élément existe déjà',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    })

    it("devrait utiliser le message d'erreur par défaut", async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 500 })

      const { execute } = useApiAction('/api/test', {
        errorMessages: {
          default: 'Une erreur est survenue',
        },
      })

      await execute()

      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    })

    it("ne devrait pas afficher de toast d'erreur avec silentError: true", async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 500 })

      const { execute } = useApiAction('/api/test', {
        silentError: true,
      })

      await execute()

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('devrait appeler onError callback', async () => {
      const mockError = { statusCode: 403 }
      mockFetch.mockRejectedValueOnce(mockError)

      const onError = vi.fn()
      const { execute } = useApiAction('/api/test', {
        onError,
      })

      await execute()

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }))
    })

    it('devrait rediriger sur erreur selon le code HTTP', async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 401 })

      const { execute } = useApiAction('/api/test', {
        redirectOnError: {
          401: '/login',
        },
      })

      await execute()

      expect(mockNavigateTo).toHaveBeenCalledWith('/login')
    })
  })

  describe('reset', () => {
    it("devrait réinitialiser l'état", async () => {
      mockFetch.mockResolvedValueOnce({ id: 1 })

      const { execute, reset, loading, error, data } = useApiAction('/api/test')

      await execute()

      expect(data.value).toEqual({ id: 1 })

      reset()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(data.value).toBeNull()
    })
  })
})

describe('useApiActionById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialisation', () => {
    it('devrait initialiser avec les valeurs par défaut', () => {
      const { loadingId, error } = useApiActionById((id) => `/api/items/${id}`)

      expect(loadingId.value).toBeNull()
      expect(error.value).toBeNull()
    })
  })

  describe('execute', () => {
    it("devrait exécuter une requête DELETE avec l'ID", async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute, loadingId, isLoading } = useApiActionById((id) => `/api/items/${id}`)

      expect(isLoading(42)).toBe(false)

      const promise = execute(42)
      expect(loadingId.value).toBe(42)
      expect(isLoading(42)).toBe(true)
      expect(isLoading(1)).toBe(false)

      await promise

      expect(loadingId.value).toBeNull()
      expect(isLoading(42)).toBe(false)
      expect(mockFetch).toHaveBeenCalledWith('/api/items/42', expect.any(Object))
    })

    it("devrait passer l'ID à la callback onSuccess", async () => {
      const mockResult = { deleted: true }
      mockFetch.mockResolvedValueOnce(mockResult)

      const onSuccess = vi.fn()
      const { execute } = useApiActionById((id) => `/api/items/${id}`, {
        onSuccess,
      })

      await execute(123)

      expect(onSuccess).toHaveBeenCalledWith(mockResult, 123)
    })

    it("devrait utiliser une fonction pour le body avec l'ID", async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiActionById((id) => `/api/items/${id}`, {
        method: 'PUT',
        body: (id) => ({ id, status: 'updated' }),
      })

      await execute(99)

      expect(mockFetch).toHaveBeenCalledWith('/api/items/99', {
        method: 'PUT',
        body: { id: 99, status: 'updated' },
        query: undefined,
      })
    })

    it('devrait afficher un toast de succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      const { execute } = useApiActionById((id) => `/api/items/${id}`, {
        successMessage: { title: 'Élément supprimé' },
      })

      await execute(1)

      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Élément supprimé',
        description: undefined,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    })
  })

  describe('gestion des erreurs', () => {
    it('devrait gérer une erreur et réinitialiser loadingId', async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 404 })

      const { execute, loadingId, error } = useApiActionById((id) => `/api/items/${id}`)

      await execute(999)

      expect(loadingId.value).toBeNull()
      expect(error.value).toEqual(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('reset', () => {
    it("devrait réinitialiser l'état", async () => {
      mockFetch.mockRejectedValueOnce({ statusCode: 500 })

      const { execute, reset, loadingId, error } = useApiActionById((id) => `/api/items/${id}`)

      await execute(1)

      expect(error.value).not.toBeNull()

      reset()

      expect(loadingId.value).toBeNull()
      expect(error.value).toBeNull()
    })
  })
})

describe('createErrorMessageResolver (via useApiAction)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait utiliser le message i18n par défaut pour erreur 400', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 400 })

    const { execute } = useApiAction('/api/test')

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'errors.invalid_request',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait utiliser le message i18n par défaut pour erreur 401', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 401 })

    const { execute } = useApiAction('/api/test')

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'errors.invalid_credentials',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait utiliser le message i18n par défaut pour erreur 403', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 403 })

    const { execute } = useApiAction('/api/test')

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'errors.access_denied',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait utiliser le message i18n par défaut pour erreur 404', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 404 })

    const { execute } = useApiAction('/api/test')

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'common.not_found',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait utiliser le message i18n générique pour code inconnu', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 418 }) // I'm a teapot

    const { execute } = useApiAction('/api/test')

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'errors.generic',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait prioriser errorMessages personnalisés sur les défauts', async () => {
    mockFetch.mockRejectedValueOnce({ statusCode: 404 })

    const { execute } = useApiAction('/api/test', {
      errorMessages: {
        404: 'Élément introuvable personnalisé',
      },
    })

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'Élément introuvable personnalisé',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })

  it('devrait prioriser errorMessages.default sur les messages API', async () => {
    mockFetch.mockRejectedValueOnce({
      statusCode: 500,
      data: { message: 'Message du serveur' },
    })

    const { execute } = useApiAction('/api/test', {
      errorMessages: {
        default: 'Message par défaut personnalisé',
      },
    })

    await execute()

    expect(mockToastAdd).toHaveBeenCalledWith({
      title: 'Message par défaut personnalisé',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  })
})
