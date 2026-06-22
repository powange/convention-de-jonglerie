import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks des auto-imports Nuxt utilisés par useErrorHandler
const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)
vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
// $fetch n'est pas directement utilisé par la logique de mapping mais stubbé par sécurité
vi.stubGlobal('$fetch', vi.fn())

import { formatHttpError, useErrorHandler, type HttpError } from '../../../app/utils/error-handler'

// Fonction de traduction factice : renvoie la clé telle quelle
const t = (key: string) => key

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('formatHttpError', () => {
    it('utilise le message de data.message en priorité', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: HttpError = Object.assign(new Error('message-bas-niveau'), {
        statusCode: 400,
        data: { message: 'Message métier détaillé' },
      })

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(result.title).toBe('errors.operation_failed')
      expect(result.description).toBe('Message métier détaillé')
    })

    it('retombe sur error.message quand data.message est absent', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: HttpError = Object.assign(new Error('Erreur réseau de bas niveau'), {
        statusCode: 500,
      })

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(result.description).toBe('Erreur réseau de bas niveau')
    })

    it('utilise la clé générique par défaut quand aucun message disponible', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      // Objet sans message ni data.message
      const error = {}

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
      })

      // genericErrorKey par défaut = 'errors.server_error', renvoyé tel quel par t
      expect(result.description).toBe('errors.server_error')
    })

    it('utilise une clé générique personnalisée si fournie', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = {}

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
        genericErrorKey: 'errors.custom_generic',
      })

      expect(result.description).toBe('errors.custom_generic')
    })

    it('traduit le titre via la fonction t', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = formatHttpError({}, (key) => `traduit:${key}`, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(result.title).toBe('traduit:errors.operation_failed')
    })

    it('logge l’erreur par défaut avec le préfixe « Error »', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('boom')

      formatHttpError(error, t, { defaultTitleKey: 'errors.operation_failed' })

      expect(spy).toHaveBeenCalledWith('Error:', error)
    })

    it('utilise un préfixe de log personnalisé', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('boom')

      formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
        logPrefix: 'MonModule',
      })

      expect(spy).toHaveBeenCalledWith('MonModule:', error)
    })

    it('ne logge pas quand logError est false', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      formatHttpError(new Error('boom'), t, {
        defaultTitleKey: 'errors.operation_failed',
        logError: false,
      })

      expect(spy).not.toHaveBeenCalled()
    })

    it('gère une erreur réseau (chaîne de caractères) sans message ni data', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      // Une string n'a ni .message ni .data.message
      const result = formatHttpError('Failed to fetch', t, {
        defaultTitleKey: 'errors.network',
      })

      expect(result.description).toBe('errors.server_error')
      expect(result.title).toBe('errors.network')
    })

    it('lève une erreur si on lui passe null (data lue sur null)', () => {
      // Le code fait `(null).data?.message` ce qui plante : comportement réel documenté ici
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() =>
        formatHttpError(null, t, {
          defaultTitleKey: 'errors.operation_failed',
        })
      ).toThrow(TypeError)
    })

    it('lève une erreur si on lui passe undefined (data lue sur undefined)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() =>
        formatHttpError(undefined, t, {
          defaultTitleKey: 'errors.operation_failed',
        })
      ).toThrow(TypeError)
    })

    it('privilégie data.message même si error.message existe aussi', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: HttpError = Object.assign(new Error('message-fallback'), {
        data: { message: 'message-data-prioritaire' },
      })

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(result.description).toBe('message-data-prioritaire')
    })

    it('ignore une data.message vide et retombe sur error.message', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: HttpError = Object.assign(new Error('message-fallback'), {
        data: { message: '' },
      })

      const result = formatHttpError(error, t, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(result.description).toBe('message-fallback')
    })
  })

  describe('useErrorHandler', () => {
    it('retourne une fonction handleError', () => {
      const { handleError } = useErrorHandler()
      expect(typeof handleError).toBe('function')
    })

    it('affiche un toast d’erreur par défaut avec titre et description', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { handleError } = useErrorHandler()

      const error: HttpError = Object.assign(new Error('ignored'), {
        data: { message: 'Quelque chose a échoué' },
      })

      const result = handleError(error, {
        defaultTitleKey: 'errors.operation_failed',
      })

      expect(mockToast.add).toHaveBeenCalledTimes(1)
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'errors.operation_failed',
        description: 'Quelque chose a échoué',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      expect(result).toEqual({
        title: 'errors.operation_failed',
        description: 'Quelque chose a échoué',
      })
    })

    it('n’affiche pas de toast quand showToast est false', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { handleError } = useErrorHandler()

      const result = handleError(new Error('erreur silencieuse'), {
        defaultTitleKey: 'errors.operation_failed',
        showToast: false,
      })

      expect(mockToast.add).not.toHaveBeenCalled()
      expect(result.description).toBe('erreur silencieuse')
    })

    it('affiche le toast quand showToast est true explicitement', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { handleError } = useErrorHandler()

      handleError(new Error('erreur visible'), {
        defaultTitleKey: 'errors.operation_failed',
        showToast: true,
      })

      expect(mockToast.add).toHaveBeenCalledTimes(1)
    })

    it('utilise les options par défaut (titre générique + toast) quand aucune option fournie', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { handleError } = useErrorHandler()

      const result = handleError(new Error('boom par défaut'))

      // defaultTitleKey par défaut = 'errors.error_occurred'
      expect(result.title).toBe('errors.error_occurred')
      expect(result.description).toBe('boom par défaut')
      expect(mockToast.add).toHaveBeenCalledTimes(1)
    })
  })
})
