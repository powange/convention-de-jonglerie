import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { MAX_ENVOIS_PAR_HEURE, uploadRateLimiter } from '../../../../server/utils/api-rate-limiter'

const DOSSIER_DES_ENVOIS = join(process.cwd(), 'server/api/files')

/*
 * ⚠️ AU SOMMET DU MODULE, et non dans le `describe` : son callback n'est pas `async`, et un `await`
 * à l'intérieur fait échouer la transformation du fichier — « Transform failed », sans un mot sur
 * la cause.
 */
const { createRateLimiter } = await vi.importActual<
  typeof import('../../../../server/utils/rate-limiter')
>('../../../../server/utils/rate-limiter')

/** Un limiteur d'envoi reconstruit sur la VRAIE fabrique, avec la limite réellement exportée. */
const limiteur = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: MAX_ENVOIS_PAR_HEURE,
  message: "Trop d'uploads, veuillez réessayer plus tard",
  keyGenerator: (event) => `upload-test:${(event.context.user as { id: number }).id}`,
})

/**
 * La borne du débit d'envoi de fichiers — constat A1.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * `uploadRateLimiter` existait, était exporté… et **personne ne l'appelait**. Mesuré un par un :
 * zéro usage hors de son fichier, comme pour trois de ses voisins. Les huit points d'envoi
 * acceptaient donc, pour tout compte connecté, un nombre **illimité** de fichiers de 10 Mo, écrits
 * sur le volume de production. La purge horaire borne la durée de vie d'un fichier temporaire, pas
 * le débit.
 *
 * Un limiteur qu'on n'appelle pas n'est pas une protection : c'est un commentaire. Il donne
 * l'impression que la surface est gardée, et c'est précisément ce qui a laissé ces points d'envoi
 * sans borne.
 *
 * ## ⚠️⚠️ LE CAS QUI COMPTE LE PLUS EST LE BALAYAGE DU DOSSIER
 *
 * Éprouver un seul handler prouverait qu'UN point d'envoi est gardé — et c'est exactement
 * l'erreur qui a conduit ici : il suffit d'en ajouter un neuvième pour que la règle redevienne
 * partielle. Le cas de tête lit donc **tous** les fichiers de `server/api/files/` et exige que
 * chacun appelle le limiteur. Il protège le code qui n'existe pas encore.
 */
describe('la limite des envois de fichiers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('⚠️ EST APPELÉE PAR TOUS LES POINTS D’ENVOI, y compris ceux à venir', async () => {
    const fichiers = (await readdir(DOSSIER_DES_ENVOIS)).filter((f) => f.endsWith('.post.ts'))

    // La sentinelle : si le dossier était vide ou mal résolu, le test passerait sans rien lire.
    expect(fichiers.length).toBeGreaterThanOrEqual(8)

    const sansLimite: string[] = []
    for (const fichier of fichiers) {
      const source = await readFile(join(DOSSIER_DES_ENVOIS, fichier), 'utf8')
      if (!source.includes('await uploadRateLimiter(event)')) sansLimite.push(fichier)
    }

    expect(sansLimite).toEqual([])
  })

  it('⚠️ L’APPELLE APRÈS L’AUTHENTIFICATION, et non avant', async () => {
    /*
     * La clé du limiteur est l'utilisateur. Appelé avant la garde d'authentification, tous les
     * envois tomberaient dans le même seau `upload:anonymous` : le premier abus bloquerait alors
     * **tout le monde**, ce qui est pire que pas de limite du tout.
     */
    const fichiers = (await readdir(DOSSIER_DES_ENVOIS)).filter((f) => f.endsWith('.post.ts'))

    for (const fichier of fichiers) {
      const source = await readFile(join(DOSSIER_DES_ENVOIS, fichier), 'utf8')
      const limite = source.indexOf('await uploadRateLimiter(event)')
      const auth = Math.max(
        source.indexOf('requireAuth(event)'),
        source.indexOf('requireGlobalAdminWithDbCheck(event)')
      )

      expect(auth, `${fichier} doit exiger une session`).toBeGreaterThan(-1)
      expect(limite, `${fichier} : limiteur avant l’authentification`).toBeGreaterThan(auth)
    }
  })

  describe('le refus au-delà de la limite', () => {
    /**
     * ⚠️ LE LIMITEUR EXPORTÉ EST UN NOOP SOUS LE HARNAIS, et c'est pour cela que ces cas
     * reconstruisent le leur.
     *
     * `test/setup.ts` remplace `createRateLimiter` par une fonction vide — pour que les tests
     * d'autres points d'API ne se heurtent pas à un 429. Conséquence : `uploadRateLimiter` ne
     * refuse rien ici, et les deux fichiers de test qui existaient à son sujet mesuraient donc
     * cette fonction vide. L'un finissait par `expect(true).toBe(true)`.
     *
     * ⚠️⚠️ ET PERSONNE N'ÉPROUVAIT LE REFUS. Les deux fichiers ne couvraient que « sous la limite,
     * ça passe » — c'est-à-dire le cas où un limiteur absent se comporte exactement comme un
     * limiteur présent. Le 429 et son `retryAfter`, dont dépendent TOUS les limiteurs de
     * l'application (authentification et inscription comprises), n'étaient vérifiés nulle part.
     *
     * On récupère donc la vraie fabrique et on lui donne la limite réellement exportée : ce qui se
     * mesure est le comportement que `uploadRateLimiter` aura en production.
     */
    /** Un événement d'envoi pour un compte donné — c'est lui qui fait la clé du limiteur. */
    const envoiDe = (userId: number) =>
      ({
        context: { user: { id: userId } },
        path: '/api/files/profile',
        node: { req: { headers: {}, socket: { remoteAddress: '10.0.0.1' } } },
      }) as never

    it('⚠️ REFUSE EN 429 AVEC `retryAfter`', async () => {
      /*
       * Le compte est unique à ce cas : le stockage du limiteur vit au niveau du module et survit
       * d'un test à l'autre. Un identifiant partagé ferait dépendre ce cas de l'ordre d'exécution.
       */
      const compte = 900001

      // La limite exacte passe…
      for (let i = 0; i < MAX_ENVOIS_PAR_HEURE; i += 1) {
        await limiteur(envoiDe(compte))
      }

      // …et le suivant est refusé, avec de quoi savoir quand réessayer.
      await expect(limiteur(envoiDe(compte))).rejects.toMatchObject({
        statusCode: 429,
        data: { retryAfter: expect.any(Number) },
      })
    })

    it('laisse passer un autre compte', async () => {
      /*
       * LE TÉMOIN. Sans lui, un limiteur qui refuserait tout le monde dès qu'un compte dépasse
       * satisferait le cas ci-dessus — et un seul abus fermerait l'envoi de fichiers pour toute
       * l'application.
       */
      const abuseur = 900002
      for (let i = 0; i <= MAX_ENVOIS_PAR_HEURE; i += 1) {
        await limiteur(envoiDe(abuseur)).catch(() => {})
      }

      await expect(limiteur(envoiDe(900003))).resolves.toBeUndefined()
    })
  })

  it('la limite de production est de soixante', () => {
    /*
     * Le chiffre est épinglé, et le passé explique pourquoi : il valait **dix**, jamais éprouvé
     * puisque le limiteur n'était branché nulle part. Dix bloquerait un organisateur en train de
     * monter une galerie. En développement et en E2E il est relevé, comme pour les limiteurs
     * d'authentification — une suite de bout en bout dépose plusieurs fichiers d'affilée.
     */
    const enProduction = import.meta.dev || process.env.E2E_TEST === 'true' ? 1000 : 60

    expect(MAX_ENVOIS_PAR_HEURE).toBe(enProduction)
  })
})
