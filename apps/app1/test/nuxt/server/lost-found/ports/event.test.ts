import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultLostFoundPorts } from '../../../../../server/lost-found/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port event du module objets trouvés (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEventTiming', () => {
    it('lit l’existence, la date de début ET de quoi décider de la visibilité', async () => {
      const startDate = new Date('2026-07-01')
      prismaMock.edition.findUnique.mockResolvedValue({
        startDate,
        status: 'PUBLISHED',
        creatorId: 7,
        convention: { authorId: 11 },
      })

      const res = await createDefaultLostFoundPorts().event.getEventTiming(10)

      expect(res).toEqual({
        found: true,
        startDate,
        visibilite: { status: 'PUBLISHED', creatorId: 7, conventionAuthorId: 11 },
      })
      /*
       * ⚠️ L'ASSERTION SUR LE `select` EST CE QUI COMPTE ICI, et c'est elle qui a changé avec le
       * constat B1 : le bouchon central rend ce qu'on lui dit, donc le cas ci-dessus resterait
       * VERT si le port cessait de demander le statut — et le handler recevrait alors un
       * `undefined` que la garde de visibilité lit comme « rien à vérifier ». La liste des objets
       * trouvés d'une édition hors ligne redeviendrait publique, en silence.
       */
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: {
          startDate: true,
          status: true,
          creatorId: true,
          convention: { select: { authorId: true } },
        },
      })
    })

    it('une édition orpheline rend des identifiants NULS, pas absents', () => {
      /*
       * `assurerEditionLisible` distingue « pas de créateur » de « champ non fourni » : le second
       * DÉSACTIVE le cas de l'édition orpheline, qu'elle traite comme publique. Un `?? null` plutôt
       * qu'un champ laissé de côté est donc une décision, pas une précaution.
       */
      prismaMock.edition.findUnique.mockResolvedValue({
        startDate: null,
        status: 'OFFLINE',
        creatorId: null,
        convention: null,
      })

      return expect(createDefaultLostFoundPorts().event.getEventTiming(10)).resolves.toEqual({
        found: true,
        startDate: null,
        visibilite: { status: 'OFFLINE', creatorId: null, conventionAuthorId: null },
      })
    })

    it('édition introuvable → found:false, et AUCUNE visibilité', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultLostFoundPorts().event.getEventTiming(999)).toEqual({
        found: false,
        startDate: null,
        // `null` et non un statut inventé : il n'y a rien dont décider, le handler rend déjà 404.
        visibilite: null,
      })
    })
  })
})
