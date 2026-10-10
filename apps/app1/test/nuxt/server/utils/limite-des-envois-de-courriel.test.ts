import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * ⚠️ LA VRAIE FABRIQUE. `test/setup.ts` remplace `createRateLimiter` par une fonction vide — pour
 * que les tests d'autres points d'API ne se heurtent pas à un 429 — et remplace aussi
 * `emailRateLimiter` lui-même. Sans ce dé-bouchonnage, tout ce fichier mesurerait une fonction
 * vide, et passerait au vert sur n'importe quelle correction.
 */
vi.mock('../../../../server/utils/rate-limiter', async (importOriginal) => importOriginal())

const { adresseDuClient, emailRateLimiter } = await import('../../../../server/utils/rate-limiter')

/**
 * La borne des envois de courriel — constat B7.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * La clé était `body?.email || user?.id || 'unknown'` : l'adresse **visée**, jamais l'expéditeur.
 * Trois conséquences, et la fiche n'en nommait que deux :
 *
 * 1. Une même machine pouvait déclencher des renvois vers **autant d'adresses qu'elle voulait** :
 *    chaque adresse ouvrait son propre compteur de trois.
 * 2. Varier la casse — « A@x.fr », « a@x.fr » — ouvrait un compteur de plus pour la même boîte.
 * 3. Et surtout : `claim.post.ts` appelle ce limiteur **sans** remplir `context.body`. La clé y
 *    valait donc la chaîne littérale `'unknown'`, **un seau partagé par tout le monde** — trois
 *    revendications par quart d'heure pour le site entier, consommées par le premier venu.
 *
 * Un corps portant `{ email: {} }` ou un tableau donnait de la même façon la clé
 * `'[object Object]'`, partagée elle aussi.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Deux adresses de client distinctes, et deux adresses visées distinctes, dans chaque cas : c'est
 * la seule façon de distinguer « compté par couple » de « compté par adresse visée » ou de
 * « compté globalement ». Un test qui n'emploierait qu'une machine et une boîte serait vert dans
 * les trois dispositions.
 */
describe('la limite des envois de courriel', () => {
  /** Une requête d'envoi, avec son adresse de client et, éventuellement, l'adresse visée. */
  const envoi = (ip: string, email?: unknown) =>
    ({
      context: email === undefined ? {} : { body: { email } },
      path: '/api/auth/resend-verification',
      node: { req: { headers: {}, socket: { remoteAddress: ip } } },
    }) as never

  /** Épuise la limite par couple (trois) pour un envoi donné. */
  const epuiser = async (faire: () => Promise<void>) => {
    for (let i = 0; i < 3; i += 1) await faire()
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('⚠️ DEUX CASSES D’UNE MÊME ADRESSE PARTAGENT LE COMPTEUR', async () => {
    const ip = '198.51.100.1'
    await epuiser(() => emailRateLimiter(envoi(ip, 'Alice@Exemple.FR')))

    // La même boîte, écrite autrement : ce doit être le même seau.
    await expect(emailRateLimiter(envoi(ip, 'alice@exemple.fr'))).rejects.toMatchObject({
      statusCode: 429,
    })
  })

  it('⚠️ UNE MACHINE NE PEUT PAS ARROSER AUTANT DE BOÎTES QU’ELLE VEUT', async () => {
    /*
     * LE PLAFOND QUI MANQUAIT. Compter par couple (client, adresse) laisse une machine ouvrir un
     * compteur neuf à chaque nouvelle adresse — c'est-à-dire exactement le spam qu'on veut borner.
     */
    const ip = '198.51.100.2'
    for (let i = 0; i < 10; i += 1) {
      await emailRateLimiter(envoi(ip, `cible${i}@exemple.fr`))
    }

    await expect(emailRateLimiter(envoi(ip, 'cible-de-trop@exemple.fr'))).rejects.toMatchObject({
      statusCode: 429,
    })
  })

  it('⚠️ UNE REQUÊTE SANS ADRESSE VISÉE EST COMPTÉE PAR MACHINE, et non dans un seau commun', async () => {
    /*
     * LE CAS DE `claim.post.ts`, que la fiche a relevé comme « pire qu'écrit ». Il appelle le
     * limiteur avant d'avoir lu le corps : la clé valait `'unknown'`, partagée par tous.
     */
    const abuseur = '198.51.100.3'
    await epuiser(() => emailRateLimiter(envoi(abuseur)))
    await expect(emailRateLimiter(envoi(abuseur))).rejects.toMatchObject({ statusCode: 429 })

    // Une autre machine, sans adresse visée non plus : elle ne doit pas payer pour la première.
    await expect(emailRateLimiter(envoi('198.51.100.4'))).resolves.toBeUndefined()
  })

  it('⚠️ UNE ADRESSE QUI N’EST PAS UNE CHAÎNE NE CRÉE PAS DE SEAU PARTAGÉ', async () => {
    /*
     * `body.email` valant un objet donnait la clé `'[object Object]'` : trois envois par quart
     * d'heure pour tous ceux qui envoient un corps mal formé — dont un attaquant qui le fait
     * exprès pour bloquer les autres.
     */
    const premier = '198.51.100.5'
    await epuiser(() => emailRateLimiter(envoi(premier, { toString: () => 'x' })))
    await expect(emailRateLimiter(envoi(premier, { toString: () => 'x' }))).rejects.toMatchObject({
      statusCode: 429,
    })

    await expect(
      emailRateLimiter(envoi('198.51.100.6', { toString: () => 'x' }))
    ).resolves.toBeUndefined()
  })

  it('laisse passer une autre machine visant la même adresse', async () => {
    /*
     * LE TÉMOIN. Sans lui, un limiteur revenu à une clé fondée sur la seule adresse VISÉE
     * satisferait les cas ci-dessus — et deux personnes qui attendent un code pour la même boîte
     * partagée (une adresse d'association, par exemple) se bloqueraient l'une l'autre.
     */
    const cible = 'partagee@exemple.fr'
    await epuiser(() => emailRateLimiter(envoi('198.51.100.7', cible)))

    await expect(emailRateLimiter(envoi('198.51.100.8', cible))).resolves.toBeUndefined()
  })

  describe('l’adresse du client', () => {
    it('⚠️ NE GARDE QUE LE PREMIER RELAIS DE `x-forwarded-for`', () => {
      /*
       * L'en-tête porte la chaîne complète des relais — `client, proxy1, proxy2`. Le limiteur par
       * défaut la prenait ENTIÈRE, là où les trois autres la découpaient : sa clé variait donc avec
       * le chemin suivi par la requête, et le même visiteur obtenait plusieurs compteurs. Les
       * quatre copies de cette expression ne faisaient pas la même chose, ce qui est la raison
       * d'en garder une seule.
       */
      const evenement = {
        node: {
          req: {
            headers: { 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1, 10.0.0.2' },
            socket: { remoteAddress: '10.0.0.3' },
          },
        },
      } as never

      expect(adresseDuClient(evenement)).toBe('203.0.113.9')
    })

    it('retombe sur la connexion quand l’en-tête est absent', () => {
      // Sans proxy — et c'est le cas en développement : l'oublier ferait tomber tout le monde dans
      // le même seau `'unknown'`, ce qui est précisément le défaut corrigé par ce lot.
      const evenement = {
        node: { req: { headers: {}, socket: { remoteAddress: '10.0.0.3' } } },
      } as never

      expect(adresseDuClient(evenement)).toBe('10.0.0.3')
    })
  })
})
