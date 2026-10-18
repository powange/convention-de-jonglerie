import { describe, it, expect, beforeEach, vi } from 'vitest'

// Les mocks DOIVENT précéder les imports du gestionnaire.
vi.mock('../../../../../server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: vi.fn(),
}))

import { requireGlobalAdminWithDbCheck } from '../../../../../server/utils/admin-auth'
import handler from '../../../../../server/api/files/generic.post'
import { global } from '../../../globales-nitro'
import { JPEG_MINIMAL } from '../../../../fixtures/fichiers-minimaux'

const mockRequireAdmin = requireGlobalAdminWithDbCheck as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: {},
    user: { id: 1, email: 'admin@example.com', pseudo: 'admin', isGlobalAdmin: true },
  },
}

const mockFile = {
  name: 'affiche.jpg',
  filename: 'affiche.jpg',
  type: 'image/jpeg',
  size: '15',
  // Un vrai début de JPEG : la validation lit les octets de signature, un texte déguisé est refusé.
  content: JPEG_MINIMAL,
}

/**
 * Ce point d'envoi n'avait AUCUN test, alors que son voisin `lost-found.post.ts` en a vingt-six.
 *
 * Il en a reçu en même temps qu'une correction de typage : `files[0]` y restait
 * `ServerFile | undefined` parce que TypeScript ne propage rien depuis un test sur `.length`. Le
 * garde teste désormais l'élément lui-même, ce qui remplace deux vérifications par une.
 *
 * ⚠️ Cette correction est **purement de typage** : vérifié par sabotage, remettre l'ancienne garde
 * ne fait tomber aucun de ces huit cas. Le comportement est identique, parce que
 * `validateUploadedFile` refusait déjà un `undefined`. Ces cas ne valent donc pas comme preuve
 * d'une faille refermée — ils valent comme la première couverture de ce point d'envoi.
 *
 * 📍 La traversée de répertoire a été examinée et elle n'est PAS atteignable : `entityId` est
 * déclaré `number` sans validation à l'exécution — le type est un vœu sur des données reçues —, mais
 * `storeFileLocally` passe par `resolveAndEnsureInside(mount, …)` de `nuxt-file-storage`, qui lève
 * dès que le chemin résolu sort du point de montage. Le nom de fichier, lui, est généré
 * aléatoirement avec une extension assainie. Rien à corriger de ce côté ; c'est écrit ici pour que
 * la question ne soit pas réinstruite à chaque lecture.
 */
describe('/api/files/generic POST', () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset().mockResolvedValue(undefined)
    global.readBody = vi.fn()
    global.storeFileLocally = vi.fn().mockResolvedValue('aB3dEf12.jpg')
  })

  describe('Le garde sur le fichier reçu', () => {
    it('refuse un tableau de fichiers VIDE', async () => {
      global.readBody.mockResolvedValue({ files: [], metadata: { endpoint: 'generic' } })

      await expect(handler(mockEvent as any)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refuse `files` ABSENT', async () => {
      global.readBody.mockResolvedValue({ metadata: { endpoint: 'generic' } })

      await expect(handler(mockEvent as any)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refuse un tableau dont le premier élément est `undefined`', async () => {
      /*
       * 📍 Ce cas ne DISTINGUE PAS l'ancienne garde de la nouvelle, et c'est mesuré : remettre
       * `files.length === 0` ne fait tomber aucun des huit cas de ce fichier. `[undefined]` passait
       * bien le test sur la longueur, mais `validateUploadedFile` commence par
       * `if (!file || typeof file !== 'object') throw 400` — il était donc déjà refusé, avec
       * « Fichier invalide » au lieu de « Aucun fichier fourni ».
       *
       * Autrement dit la correction de ce lot est **purement de typage, à comportement
       * identique** : c'est rassurant, et il fallait le dire plutôt que de laisser croire à une
       * faille refermée. Le cas reste utile comme couverture — qu'un tableau d'éléments vides soit
       * refusé est une propriété qui mérite une garde, quelle que soit la couche qui l'assure.
       */
      global.readBody.mockResolvedValue({
        files: [undefined],
        metadata: { endpoint: 'generic' },
      })

      await expect(handler(mockEvent as any)).rejects.toBeDefined()
    })

    it('n’écrit RIEN quand le corps est refusé', async () => {
      // Sans ce cas, les précédents seraient satisfaits par un refus survenant APRÈS l'écriture.
      global.readBody.mockResolvedValue({ files: [], metadata: { endpoint: 'generic' } })

      await expect(handler(mockEvent as any)).rejects.toBeDefined()
      expect(global.storeFileLocally).not.toHaveBeenCalled()
    })
  })

  describe('Le dépôt réussi', () => {
    it('range dans `temp` et le signale quand aucun `entityId` n’est fourni', async () => {
      global.readBody.mockResolvedValue({ files: [mockFile], metadata: { endpoint: 'generic' } })

      const resultat: any = await handler(mockEvent as any)

      expect(global.storeFileLocally).toHaveBeenCalledWith(mockFile, 8, 'temp')
      expect(resultat.data.imageUrl).toBe('/uploads/temp/aB3dEf12.jpg')
      expect(resultat.data.temporary).toBe(true)
    })

    it('range sous `generic/<id>` quand un `entityId` est fourni', async () => {
      global.readBody.mockResolvedValue({
        files: [mockFile],
        metadata: { endpoint: 'generic', entityId: 42 },
      })

      const resultat: any = await handler(mockEvent as any)

      expect(global.storeFileLocally).toHaveBeenCalledWith(mockFile, 8, 'generic/42')
      expect(resultat.data.imageUrl).toBe('/uploads/generic/42/aB3dEf12.jpg')
      expect(resultat.data.temporary).toBe(false)
    })

    it('ne prend que le PREMIER fichier', async () => {
      const second = { ...mockFile, name: 'second.jpg' }
      global.readBody.mockResolvedValue({
        files: [mockFile, second],
        metadata: { endpoint: 'generic' },
      })

      await handler(mockEvent as any)

      expect(global.storeFileLocally).toHaveBeenCalledTimes(1)
      expect(global.storeFileLocally).toHaveBeenCalledWith(mockFile, 8, 'temp')
    })
  })

  describe('L’accès', () => {
    it('exige un administrateur global AVANT de lire le corps', async () => {
      /*
       * L'ordre compte : lire le corps d'abord exposerait le point d'envoi à un corps volumineux
       * envoyé sans droits. On vérifie donc que le refus d'accès survient sans lecture.
       */
      mockRequireAdmin.mockRejectedValue(
        Object.assign(new Error('Accès refusé'), { statusCode: 403 })
      )
      global.readBody.mockResolvedValue({ files: [mockFile], metadata: { endpoint: 'generic' } })

      await expect(handler(mockEvent as any)).rejects.toBeDefined()
      expect(global.readBody).not.toHaveBeenCalled()
    })
  })
})
