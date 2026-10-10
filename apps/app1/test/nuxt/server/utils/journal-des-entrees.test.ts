import { describe, it, expect, beforeEach, vi } from 'vitest'

import { journaliserMouvementDEntree } from '../../../../server/utils/ticketing/journal-des-entrees'

const prismaMock = (globalThis as any).prisma

/**
 * Le journal des mouvements d'entrée, et surtout ce qui se passe quand il n'arrive pas à écrire.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE
 *
 * Le constat A3 de l'audit disait « la dévalidation efface qui avait validé », et sa conclusion
 * était déjà **fausse** : `EntryValidationLog` conserve le mouvement depuis un lot antérieur. Mais
 * il gardait une réserve juste, et c'est elle qu'on ferme ici — la trace est au **mieux-effort**, et
 * son échec ne partait qu'en `console.error`, c'est-à-dire dans les journaux du conteneur.
 *
 * Or après une dévalidation, les colonnes d'état sont remises à `null` : **le journal est la seule
 * trace qui reste**. S'il n'a pas pu s'écrire, il faut le savoir avant qu'on ne vienne demander à
 * quelle heure quelqu'un est passé — pas six mois plus tard.
 *
 * ## Ce qui NE change pas, et que ces cas figent
 *
 * Le choix de **ne pas bloquer** est délibéré et documenté : une file d'attente à l'entrée ne doit
 * pas s'arrêter parce qu'une ligne de traçabilité manque. Deux cas le verrouillent — la fonction
 * résout malgré l'échec, et elle ne lève pas davantage quand le signalement lui-même échoue.
 */
describe('journaliserMouvementDEntree', () => {
  const options = {
    editionId: 7,
    type: 'ticket' as const,
    participantIds: [11, 12],
    mouvement: 'INVALIDATION' as never,
    actorId: 3,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.entryValidationLog.createMany.mockResolvedValue({ count: 2 })
    prismaMock.apiErrorLog.create.mockResolvedValue({ id: 'e1' })
  })

  it('écrit une ligne par participant', async () => {
    await journaliserMouvementDEntree(options)

    expect(prismaMock.entryValidationLog.createMany).toHaveBeenCalledTimes(1)
    const data = prismaMock.entryValidationLog.createMany.mock.calls[0][0].data
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ editionId: 7, participantKind: 'TICKET', actorId: 3 })
  })

  it('n’écrit rien quand la liste est vide', async () => {
    /*
     * Cas courant et légitime : `updateMany` n'a rien changé parce que tout était déjà validé. Un
     * journal ne consigne pas les gestes sans effet — et sans ce cas, une écriture systématique
     * remplirait la table de lignes à zéro participant.
     */
    await journaliserMouvementDEntree({ ...options, participantIds: [] })

    expect(prismaMock.entryValidationLog.createMany).not.toHaveBeenCalled()
    expect(prismaMock.apiErrorLog.create).not.toHaveBeenCalled()
  })

  describe('quand l’écriture échoue', () => {
    beforeEach(() => {
      prismaMock.entryValidationLog.createMany.mockRejectedValue(new Error('table absente'))
    })

    it('n’interrompt pas le geste métier', async () => {
      // ⚠️ Le choix de ne pas bloquer est délibéré : la file d'entrée ne s'arrête pas pour une
      // ligne de traçabilité. Ce cas l'empêche d'être « corrigé » en propageant l'erreur.
      await expect(journaliserMouvementDEntree(options)).resolves.toBeUndefined()
    })

    it('⚠️ CONSIGNE L’ÉCHEC LÀ OÙ ON LE VERRA, pas seulement dans la console', async () => {
      /*
       * LE CAS QUI FERME LE CONSTAT. `console.error` part dans les journaux du conteneur, que
       * personne ne relit ; `ApiErrorLog` est montré par l'écran d'administration et interrogé par
       * la surveillance. Sans ce cas, le silence d'origine resterait, et il est le plus coûteux
       * précisément ici — après une dévalidation, ce journal est la seule trace qui subsiste.
       */
      await journaliserMouvementDEntree(options)

      expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
      const data = prismaMock.apiErrorLog.create.mock.calls[0][0].data
      expect(data.statusCode).toBe(500)
      expect(data.errorType).toBe('EntryLogWriteError')
      // Les identifiants concernés sont dans l'enregistrement : sans eux, on saurait qu'un échec a
      // eu lieu sans savoir SUR QUI — donc sans pouvoir rattraper quoi que ce soit.
      expect(data.prismaDetails).toMatchObject({
        editionId: 7,
        participantKind: 'TICKET',
        movement: 'INVALIDATION',
        participantIds: [11, 12],
      })
    })

    it('ne lève pas non plus si le signalement échoue à son tour', async () => {
      /*
       * Si même `ApiErrorLog` est inaccessible, la base entière l'est — et ce n'est pas au journal
       * des entrées de faire tomber le guichet pour l'annoncer. Sans ce cas, une base indisponible
       * transformerait une validation réussie en erreur 500.
       */
      prismaMock.apiErrorLog.create.mockRejectedValue(new Error('base injoignable'))

      await expect(journaliserMouvementDEntree(options)).resolves.toBeUndefined()
    })
  })
})
