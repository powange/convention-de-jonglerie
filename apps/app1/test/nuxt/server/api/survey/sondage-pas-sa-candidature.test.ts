import { describe, it, expect, vi, beforeEach } from 'vitest'

import liste from '../../../../../server/api/survey/[token].get'
import vote from '../../../../../server/api/survey/[token]/vote.put'

const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  }),
}))

/**
 * Un candidat ne note pas sa propre candidature.
 *
 * ## Le défaut
 *
 * Le sondage est ouvert à **tout** utilisateur connecté qui possède le jeton, et c'est **voulu** :
 * il sert à un jury informel qu'on constitue en partageant un lien, sans gérer de comptes. Mais
 * `user.id` ne servait qu'à **identifier** le votant — il n'était jamais comparé à
 * `application.userId`. Un artiste ayant candidaté à cet appel pouvait donc se mettre la note
 * maximale, et son vote comptait dans la moyenne comme les autres.
 *
 * ## 📍 POURQUOI CES POINTS D'API N'AVAIENT AUCUN TEST
 *
 * `showCallSurveyVote` manquait au mock central de Prisma. Une méthode absente n'y rend pas
 * `undefined` : elle fait lever « n'est pas une fonction » au premier appel, **avant** toute
 * assertion. Le code devient intestable, ce qui se lit à tort comme une absence de tests. Sixième
 * fois que ce harnais bloque un test de cette façon.
 *
 * ## ⚠️ CE QUE CE LOT NE FERME PAS, ET QUI EST ASSUMÉ
 *
 * Un artiste candidat qui détient le jeton voit toujours la bio, les liens et la description de ses
 * **concurrents**. C'est inhérent au dispositif — le jeton est le seul contrôle d'accès — et le
 * constat d'audit le reconnaît en parlant du « cas le plus gênant ». Fermer celui-là demanderait de
 * refuser l'accès entier à un candidat, donc de décider que le sondage n'est plus un simple lien
 * partageable.
 */
describe('sondage — on ne note pas sa propre candidature', () => {
  const MOI = { id: 7, pseudo: 'artiste', isGlobalAdmin: false }
  const APPEL = { id: 3, name: 'Cabaret', surveyOpen: true, edition: { id: 1, name: 'Éd.' } }

  const evenement = (corps?: unknown) => ({
    context: { user: MOI, params: { token: 'jeton-secret' } },
    node: { req: { url: '/api/survey/jeton-secret', headers: {}, method: 'PUT' } },
    _body: corps,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionShowCall.findUnique.mockResolvedValue(APPEL)
    prismaMock.showCallSurveyVote.findMany.mockResolvedValue([])
    prismaMock.showCallSurveyVote.groupBy.mockResolvedValue([])
    prismaMock.showApplication.count.mockResolvedValue(0)
  })

  describe('le vote', () => {
    beforeEach(() => {
      // @ts-expect-error — `readBody` est un auto-import de Nitro, remplacé pour le test.
      globalThis.readBody = vi.fn(async (e: any) => e._body)
    })

    it('refuse en 403 un vote sur sa propre candidature', async () => {
      prismaMock.showApplication.findFirst.mockResolvedValue({ id: 11, userId: MOI.id })

      await expect(vote(evenement({ applicationId: 11, score: 5 }) as any)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Vous ne pouvez pas noter votre propre candidature',
      })
      // Rien n'est écrit : le refus précède l'`upsert`.
      expect(prismaMock.showCallSurveyVote.upsert).not.toHaveBeenCalled()
    })

    it('accepte un vote sur la candidature de quelqu’un d’autre', async () => {
      /*
       * ⚠️ LE TÉMOIN POSITIF, sans lequel le cas ci-dessus ne prouverait rien : une garde qui
       * refuse TOUT le satisferait aussi, et le sondage ne fonctionnerait plus du tout.
       */
      prismaMock.showApplication.findFirst.mockResolvedValue({ id: 12, userId: 99 })
      prismaMock.showCallSurveyVote.upsert.mockResolvedValue({ applicationId: 12, score: 4 })

      const resultat: any = await vote(evenement({ applicationId: 12, score: 4 }) as any)
      expect(resultat.data.vote).toEqual({ applicationId: 12, score: 4 })
      expect(prismaMock.showCallSurveyVote.upsert).toHaveBeenCalled()
    })

    it('demande `userId` à la base, sans quoi la garde n’aurait rien à comparer', () => {
      /*
       * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE le `select` : il rend ce qu'on
       * lui a dit de rendre. Les deux cas ci-dessus resteraient donc VERTS si le handler cessait de
       * demander `userId` — et en production `application.userId` vaudrait `undefined`, jamais égal
       * à `user.id` : la garde laisserait tout passer, en silence.
       */
      prismaMock.showApplication.findFirst.mockResolvedValue({ id: 12, userId: 99 })
      prismaMock.showCallSurveyVote.upsert.mockResolvedValue({ applicationId: 12, score: 4 })

      return vote(evenement({ applicationId: 12, score: 4 }) as any).then(() => {
        expect(prismaMock.showApplication.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ select: { id: true, userId: true } })
        )
      })
    })
  })

  describe('la liste', () => {
    it('exclut la candidature du demandeur de la requête', async () => {
      prismaMock.showApplication.findMany.mockResolvedValue([])

      await liste(evenement() as any)
      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { not: MOI.id } }),
        })
      )
    })

    it('annonce `isApplicant` quand le demandeur a candidaté', async () => {
      // Sans cet indicateur, l'absence de sa fiche passerait pour un défaut de la page.
      prismaMock.showApplication.findMany.mockResolvedValue([])
      prismaMock.showApplication.count.mockResolvedValue(1)

      const resultat: any = await liste(evenement() as any)
      expect(resultat.isApplicant).toBe(true)
    })

    it('ne l’annonce pas pour un membre du jury qui n’a pas candidaté', async () => {
      prismaMock.showApplication.findMany.mockResolvedValue([])
      prismaMock.showApplication.count.mockResolvedValue(0)

      const resultat: any = await liste(evenement() as any)
      expect(resultat.isApplicant).toBe(false)
    })

    it('compte sa propre candidature sur TOUS les statuts', async () => {
      /*
       * Une candidature acceptée ou refusée ne figure de toute façon pas dans un sondage, mais son
       * auteur mérite la même explication : le `count` ne filtre donc pas sur `PENDING`.
       */
      prismaMock.showApplication.findMany.mockResolvedValue([])

      await liste(evenement() as any)
      expect(prismaMock.showApplication.count).toHaveBeenCalledWith({
        where: { showCallId: APPEL.id, userId: MOI.id },
      })
    })

    it('retire des résultats la moyenne de sa propre candidature', async () => {
      /*
       * ⚠️ RETIRER UNE LIGNE DE L'ÉCRAN EN LA LAISSANT DANS LA CHARGE UTILE N'EST PAS LA RETIRER.
       * L'agrégation porte sur toutes les candidatures : la laisser entière renverrait au candidat
       * la moyenne de sa propre fiche, que la liste venait justement d'exclure. Rien ne
       * l'afficherait, mais elle serait dans la réponse.
       */
      prismaMock.editionShowCall.findUnique.mockResolvedValue({ ...APPEL, surveyOpen: false })
      prismaMock.showApplication.findMany.mockResolvedValue([{ id: 12 }])
      prismaMock.showCallSurveyVote.groupBy.mockResolvedValue([
        { applicationId: 12, _avg: { score: 4 }, _count: { score: 2 } },
        { applicationId: 11, _avg: { score: 5 }, _count: { score: 1 } },
      ])

      const resultat: any = await liste(evenement() as any)
      expect(resultat.results.map((r: any) => r.applicationId)).toEqual([12])
    })
  })
})
