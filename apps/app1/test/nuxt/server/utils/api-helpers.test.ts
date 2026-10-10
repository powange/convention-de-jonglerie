import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

import {
  wrapApiHandler,
  handlePrismaError,
  createSuccessResponse,
  createPaginatedResponse,
} from '../../../../server/utils/api-helpers'

import { ApiError, BadRequestError, ForbiddenError } from '../../../../server/utils/errors'

describe('api-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSuccessResponse', () => {
    it('devrait créer une réponse de succès simple', () => {
      const data = { id: 1, name: 'Test' }

      const result = createSuccessResponse(data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.message).toBeUndefined()
    })

    it('devrait inclure un message optionnel', () => {
      const data = { id: 1 }

      const result = createSuccessResponse(data, 'Opération réussie')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.message).toBe('Opération réussie')
    })

    it('devrait fonctionner avec un tableau', () => {
      const data = [{ id: 1 }, { id: 2 }]

      const result = createSuccessResponse(data)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('devrait fonctionner avec null', () => {
      const result = createSuccessResponse(null)

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })
  })

  describe('createPaginatedResponse', () => {
    it('devrait créer une réponse paginée correcte', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]

      const result = createPaginatedResponse(items, 100, 1, 10)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(items)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalCount).toBe(100)
      expect(result.pagination.totalPages).toBe(10)
      expect(result.pagination.hasNextPage).toBe(true)
      expect(result.pagination.hasPrevPage).toBe(false)
    })

    it('devrait calculer hasNextPage correctement', () => {
      const items = [{ id: 1 }]

      // Page 1 sur 5 pages -> hasNextPage = true
      let result = createPaginatedResponse(items, 50, 1, 10)
      expect(result.pagination.hasNextPage).toBe(true)

      // Page 5 sur 5 pages -> hasNextPage = false
      result = createPaginatedResponse(items, 50, 5, 10)
      expect(result.pagination.hasNextPage).toBe(false)

      // Page 3 sur 5 pages -> hasNextPage = true
      result = createPaginatedResponse(items, 50, 3, 10)
      expect(result.pagination.hasNextPage).toBe(true)
    })

    it('devrait calculer hasPrevPage correctement', () => {
      const items = [{ id: 1 }]

      // Page 1 -> hasPrevPage = false
      let result = createPaginatedResponse(items, 50, 1, 10)
      expect(result.pagination.hasPrevPage).toBe(false)

      // Page 2 -> hasPrevPage = true
      result = createPaginatedResponse(items, 50, 2, 10)
      expect(result.pagination.hasPrevPage).toBe(true)

      // Page 5 -> hasPrevPage = true
      result = createPaginatedResponse(items, 50, 5, 10)
      expect(result.pagination.hasPrevPage).toBe(true)
    })

    it('devrait calculer totalPages correctement', () => {
      const items: any[] = []

      // 100 items, 10 par page = 10 pages
      let result = createPaginatedResponse(items, 100, 1, 10)
      expect(result.pagination.totalPages).toBe(10)

      // 95 items, 10 par page = 10 pages (arrondi supérieur)
      result = createPaginatedResponse(items, 95, 1, 10)
      expect(result.pagination.totalPages).toBe(10)

      // 1 item, 10 par page = 1 page
      result = createPaginatedResponse(items, 1, 1, 10)
      expect(result.pagination.totalPages).toBe(1)

      // 0 items = 0 pages
      result = createPaginatedResponse(items, 0, 1, 10)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('devrait fonctionner avec une liste vide', () => {
      const result = createPaginatedResponse([], 0, 1, 10)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.pagination.totalCount).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.hasPrevPage).toBe(false)
    })
  })

  describe('handlePrismaError', () => {
    /**
     * L'erreur levée, capturée sans risque de silence.
     *
     * ⚠️ LES TROIS CAS P2002 ÉTAIENT ÉCRITS EN `try { … } catch (e) { expect(…) }`, et deux d'entre
     * eux sans aucune garde : si la fonction cessait de lever, le `catch` ne s'exécutait jamais et
     * le test passait **sans rien vérifier**. Ce helper exige qu'une erreur ait bien été levée.
     */
    const refusLeve = (error: unknown, context?: string) => {
      try {
        handlePrismaError(error, context)
      } catch (e) {
        return e as { statusCode: number; message: string; data?: { champ?: string | null } }
      }
      throw new Error('handlePrismaError devait lever')
    }

    it('⚠️ NE MET PLUS LE NOM DE COLONNE DANS LE MESSAGE (P2002)', () => {
      /*
       * Il rendait « Ce email est déjà utilisé » — et, sur un index composite, « Ce editionId_name
       * est déjà utilisé » : le nom de l'index Prisma, lisible par personne, et une fuite du schéma
       * dans une réponse d'API. Le champ reste disponible dans `data` pour qui veut l'afficher.
       */
      const erreur = refusLeve({ code: 'P2002', meta: { target: ['email'] } })

      expect(erreur.statusCode).toBe(409)
      expect(erreur.message).toBe('Cette valeur est déjà utilisée')
      expect(erreur.data?.champ).toBe('email')
    })

    it('garde tous les champs d’un index composite dans `data`', () => {
      // L'ancien code ne gardait que le PREMIER : sur `[editionId, name]`, il annonçait « Ce
      // editionId est déjà utilisé », ce qui désigne le mauvais champ.
      const erreur = refusLeve({ code: 'P2002', meta: { target: ['editionId', 'name'] } })

      expect(erreur.data?.champ).toBe('editionId, name')
    })

    it('reste exploitable sans `meta`', () => {
      const erreur = refusLeve({ code: 'P2002' })

      expect(erreur.statusCode).toBe(409)
      expect(erreur.message).toBe('Cette valeur est déjà utilisée')
      expect(erreur.data?.champ).toBeNull()
    })

    it("devrait gérer l'erreur P2025 (enregistrement non trouvé)", () => {
      const error = { code: 'P2025' }

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
        expect(e.message).toBe('Ressource introuvable')
      }
    })

    it('devrait utiliser le contexte pour P2025', () => {
      const error = { code: 'P2025' }

      try {
        handlePrismaError(error, 'Utilisateur')
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
        expect(e.message).toBe('Utilisateur introuvable')
      }
    })

    it("devrait gérer l'erreur P2003 (clé étrangère)", () => {
      const error = { code: 'P2003' }

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
        expect(e.message).toBe('Référence invalide')
      }
    })

    it('devrait gérer les erreurs Prisma inconnues', () => {
      const error = { code: 'P9999' }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => handlePrismaError(error)).toThrow()
      try {
        handlePrismaError(error)
      } catch (e: any) {
        expect(e.statusCode).toBe(500)
        expect(e.message).toBe('Erreur de base de données')
      }

      consoleSpy.mockRestore()
    })

    it('devrait relancer les erreurs non-Prisma', () => {
      const error = new Error('Not a Prisma error')

      expect(() => handlePrismaError(error)).toThrow('Not a Prisma error')
    })

    it('devrait relancer null', () => {
      expect(() => handlePrismaError(null)).toThrow()
    })
  })

  describe('wrapApiHandler', () => {
    it('devrait retourner le résultat du handler en cas de succès', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 'test' })
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      const result = await wrapped(mockEvent)

      expect(result).toEqual({ success: true, data: 'test' })
      expect(handler).toHaveBeenCalledWith(mockEvent)
    })

    it('devrait relancer les erreurs HTTP directement', async () => {
      const httpError = { statusCode: 404, message: 'Not found' }
      const handler = vi.fn().mockRejectedValue(httpError)
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toEqual(httpError)
    })

    it('devrait convertir les ApiError en erreurs HTTP', async () => {
      const apiError = new ForbiddenError('Accès refusé')
      const handler = vi.fn().mockRejectedValue(apiError)
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Accès refusé',
      })
    })

    it('devrait convertir les erreurs génériques en 500', async () => {
      const genericError = new Error('Something went wrong')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Erreur serveur interne',
      })

      consoleSpy.mockRestore()
    })

    it("devrait utiliser le message d'erreur par défaut personnalisé", async () => {
      const genericError = new Error('Something went wrong')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { defaultErrorMessage: 'Custom error' })
      const mockEvent = {} as any

      await expect(wrapped(mockEvent)).rejects.toMatchObject({
        statusCode: 500,
        message: 'Custom error',
      })

      consoleSpy.mockRestore()
    })

    it('devrait logger les erreurs avec operationName', async () => {
      const genericError = new Error('Test error')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { operationName: 'TestOp' })
      const mockEvent = {} as any

      try {
        await wrapped(mockEvent)
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('[TestOp] Erreur inattendue:', genericError)
      consoleSpy.mockRestore()
    })

    it('devrait ne pas logger si silentErrors est true', async () => {
      const genericError = new Error('Test error')
      const handler = vi.fn().mockRejectedValue(genericError)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const wrapped = wrapApiHandler(handler, { silentErrors: true })
      const mockEvent = {} as any

      try {
        await wrapped(mockEvent)
      } catch {
        // Expected
      }

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('devrait gérer les handlers synchrones', async () => {
      const handler = vi.fn().mockReturnValue({ sync: true })
      const wrapped = wrapApiHandler(handler)
      const mockEvent = {} as any

      const result = await wrapped(mockEvent)

      expect(result).toEqual({ sync: true })
    })

    /**
     * Les erreurs Prisma traversaient ce wrapper en 500 — constat A7.
     *
     * ## ⚠️ LE DÉFAUT
     *
     * `handlePrismaError` traduit P2002 en 409, P2025 en 404 et P2003 en 400 depuis longtemps.
     * **Aucun des 552 handlers ne l'appelait** : zéro usage mesuré. Partout, une contrainte unique
     * ou une clé étrangère violée arrivait ici comme erreur générique — 500, message neutre, ligne
     * de journal en « erreur inattendue », et pour l'utilisateur un « Erreur serveur interne » là
     * où « déjà existant » ou « référence invalide » l'orienterait.
     *
     * 📍 C'est le cas le plus coûteux de code mort : il était **testé**, huit cas, donc il avait
     * l'air vivant. Il le restait tant qu'on jugeait sur la couverture.
     *
     * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
     *
     * Ils passent par `wrapApiHandler`, c'est-à-dire par le chemin que prennent les 552 handlers —
     * et non par `handlePrismaError` directement, qui était déjà couvert et ne prouvait rien sur le
     * branchement. Le témoin est un code Prisma INCONNU : il doit rester un 500 bruyant.
     */
    describe('les erreurs Prisma connues', () => {
      const parLeWrapper = async (error: unknown) => {
        const wrapped = wrapApiHandler(vi.fn().mockRejectedValue(error), {
          operationName: 'TestPrisma',
        })
        try {
          await wrapped({} as any)
        } catch (e) {
          return e as { statusCode: number; message: string; data?: { champ?: string | null } }
        }
        throw new Error('le wrapper devait lever')
      }

      it('⚠️ TRADUIT P2002 EN 409, et non en 500', async () => {
        const erreur = await parLeWrapper({ code: 'P2002', meta: { target: ['name'] } })

        expect(erreur.statusCode).toBe(409)
        expect(erreur.message).toBe('Cette valeur est déjà utilisée')
        expect(erreur.data?.champ).toBe('name')
      })

      it('⚠️ TRADUIT P2025 EN 404', async () => {
        const erreur = await parLeWrapper({ code: 'P2025' })

        expect(erreur.statusCode).toBe(404)
      })

      it('⚠️ TRADUIT P2003 EN 400', async () => {
        const erreur = await parLeWrapper({ code: 'P2003' })

        expect(erreur.statusCode).toBe(400)
        expect(erreur.message).toBe('Référence invalide')
      })

      it('laisse un code Prisma INCONNU en 500 bruyant', async () => {
        /*
         * LE TÉMOIN, et il protège la diagnosticabilité. Tout déléguer ferait perdre aux codes
         * inconnus le journal « erreur inattendue » avec son `operationName` — la seule trace qui
         * permette de retrouver l'appel fautif. Un code qu'on n'a pas prévu doit rester une
         * surprise bruyante.
         */
        const journal = vi.spyOn(console, 'error').mockImplementation(() => {})

        const erreur = await parLeWrapper({ code: 'P2037', message: 'trop de connexions' })

        expect(erreur.statusCode).toBe(500)
        expect(journal).toHaveBeenCalledWith(
          expect.stringContaining('[TestPrisma]'),
          expect.anything()
        )
        journal.mockRestore()
      })

      it('ne confond pas un code système avec un code Prisma', async () => {
        /*
         * SECOND TÉMOIN. La détection d'origine testait seulement la PRÉSENCE d'un champ `code` :
         * une erreur de système de fichiers (`ENOENT`) y aurait été prise pour une erreur Prisma et
         * rendue en 500 « Erreur de base de données », message qui envoie chercher au mauvais
         * endroit. La liste des codes traduits est fermée.
         */
        const journal = vi.spyOn(console, 'error').mockImplementation(() => {})

        const erreur = await parLeWrapper(
          Object.assign(new Error('fichier absent'), { code: 'ENOENT' })
        )

        expect(erreur.statusCode).toBe(500)
        expect(erreur.message).toBe('Erreur serveur interne')
        journal.mockRestore()
      })

      it('laisse passer le refus d’un handler qui gère déjà P2002 lui-même', async () => {
        /*
         * TROISIÈME TÉMOIN, et il garde sept fichiers. Les handlers qui traitent P2002 à la main
         * lèvent leur propre erreur HTTP, avec un message plus précis — « Ce tag existe déjà pour
         * cette édition ». Elle est reconnue plus tôt dans la chaîne, donc ce branchement ne doit
         * pas la remplacer par son message générique.
         */
        const erreur = await parLeWrapper({
          statusCode: 409,
          message: 'Ce tag existe déjà pour cette édition',
        })

        expect(erreur.message).toBe('Ce tag existe déjà pour cette édition')
      })
    })
  })
})
