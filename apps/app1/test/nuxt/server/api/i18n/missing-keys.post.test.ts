import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/i18n/missing-keys.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/*
 * ⚠️ LA VRAIE FABRIQUE, et non celle du harnais.
 *
 * `test/setup.ts` remplace `createRateLimiter` par une fonction vide — pour que les tests d'autres
 * points d'API ne se heurtent pas à un 429. Le limiteur de ce handler serait donc un noop, et un
 * cas qui compterait les appels passerait au vert sans rien éprouver. On rend ici le module intact,
 * pour ce fichier seulement.
 */
vi.mock('#server/utils/rate-limiter', async (importOriginal) => importOriginal())
vi.mock('../../../../../server/utils/rate-limiter', async (importOriginal) => importOriginal())

/**
 * La remontée des clés i18n manquantes — constat A4.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * La route est **publique** — des clés peuvent manquer sur une page que personne n'a ouverte en
 * étant connecté — et elle **écrit en base** : une ligne par clé inconnue, cinquante clés par appel.
 * Sans limiteur, n'importe qui pouvait remplir le journal d'administration, que la purge ne vide
 * qu'à quatre-vingt-dix jours, et ralentir l'écran `/admin/error-logs`.
 *
 * ⚠️ La moitié de la fiche était déjà traitée : schéma zod, clés bornées à cinquante,
 * **déduplication** (une clé déjà vue incrémente un compteur). Les « cinquante lignes de journal
 * par appel » n'existaient plus. Ce qui restait entier, c'est l'absence de limiteur.
 *
 * ## ⚠️⚠️ CE QUI N'EST PAS FAIT, ET POURQUOI
 *
 * La fiche proposait aussi de n'accepter que les clés d'un domaine i18n connu. **Cela ne bornerait
 * rien** : les domaines sont en nombre fini, les suffixes non — `common.aaaa`, `common.aaab`…
 * restent autant de clés distinctes, donc autant de lignes. Et la liste, déduite des fichiers de
 * locales, **divergerait entre développement et production** : `volunteers` n'existe que dans
 * `layers/volunteers/i18n`, un dossier absent de l'image. Les clés `volunteers.*` seraient
 * acceptées ici et refusées là-bas — précisément là où l'on cherche les clés manquantes.
 */
describe('POST /api/i18n/missing-keys', () => {
  /** Un appel depuis une adresse donnée : c'est elle qui fait la clé du limiteur. */
  const appelDepuis = (ip: string) =>
    ({
      context: {},
      path: '/api/i18n/missing-keys',
      node: { req: { headers: {}, socket: { remoteAddress: ip } } },
    }) as never

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.apiErrorLog.findFirst.mockResolvedValue(null)
    prismaMock.apiErrorLog.create.mockResolvedValue({ id: 'log-1' })
    prismaMock.apiErrorLog.update.mockResolvedValue({ id: 'log-1' })
    global.readBody = vi.fn().mockResolvedValue({
      keys: [{ key: 'common.bonjour', locale: 'fr' }],
      path: '/editions/7',
    })
  })

  it('⚠️ REFUSE EN 429 AU-DELÀ DE DIX APPELS PAR MINUTE', async () => {
    /*
     * LE CŒUR DU CONSTAT. Une adresse unique à ce cas : le stockage du limiteur vit au niveau du
     * module et survit d'un test à l'autre, donc une adresse partagée ferait dépendre ce cas de
     * l'ordre d'exécution.
     */
    const ip = '203.0.113.10'

    for (let i = 0; i < 10; i += 1) {
      await handler(appelDepuis(ip))
    }

    await expect(handler(appelDepuis(ip))).rejects.toMatchObject({
      statusCode: 429,
      data: { retryAfter: expect.any(Number) },
    })
  })

  it('n’empêche pas une autre adresse d’écrire', async () => {
    /*
     * LE TÉMOIN. Sans lui, un limiteur qui refuserait tout le monde dès qu'une adresse dépasse
     * satisferait le cas ci-dessus — et une seule page fautive ferait taire la remontée pour tous
     * les visiteurs, c'est-à-dire exactement ce qu'on veut savoir.
     */
    const abuseur = '203.0.113.11'
    for (let i = 0; i <= 11; i += 1) await handler(appelDepuis(abuseur)).catch(() => {})

    await expect(handler(appelDepuis('203.0.113.12'))).resolves.toMatchObject({ success: true })
  })

  it('journalise une clé inconnue, une seule fois par clé', async () => {
    /*
     * Second témoin : la déduplication existait avant ce lot et doit survivre. Sans ce cas, un
     * limiteur bien posé sur un handler qui aurait perdu sa déduplication laisserait la table
     * grossir d'un cran par appel.
     */
    global.readBody = vi.fn().mockResolvedValue({
      keys: [
        { key: 'common.bonjour', locale: 'fr' },
        { key: 'common.bonjour', locale: 'en' },
      ],
      path: '/editions/7',
    })

    const reponse = (await handler(appelDepuis('203.0.113.13'))) as { count: number }

    expect(reponse.count).toBe(1)
    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
  })

  it('cherche le doublon sur `errorType` ET `message`, les deux colonnes indexées', async () => {
    /*
     * ⚠️ CE CAS GARDE L'INDEX UTILE. `message` est un `Text` : il n'était pas indexable, donc
     * chaque clé reçue déclenchait un balayage complet d'une table que la purge ne vide qu'à
     * quatre-vingt-dix jours — cinquante balayages par appel. La migration ajoute
     * `@@index([errorType, message(length: 191)])`, et cet index ne sert que si la recherche porte
     * sur ces deux colonnes dans cet ordre. Le mock de Prisma ignorant le `where`, c'est la
     * REQUÊTE qui se mesure, pas son résultat.
     */
    await handler(appelDepuis('203.0.113.14'))

    expect(prismaMock.apiErrorLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { errorType: 'I18nMissingKey', message: 'common.bonjour' },
      })
    )
  })
})
