import { describe, it, expect } from 'vitest'

import { analyserUrlDeBase } from '../../../server/utils/url-de-base-de-donnees'

/**
 * Les identifiants de `DATABASE_URL` arrivent DÉCODÉS au pilote.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et pourquoi le symptôme égarait. `prisma.ts` passait `url.username`,
 * `url.password` et `url.pathname` directement au pilote MariaDB. Or `new URL()` rend ces champs
 * POURCENT-ENCODÉS : un mot de passe écrit `p%40ss` dans l'URL — la seule écriture valable pour
 * `p@ss` — arrivait au pilote sous la forme littérale `p%40ss`.
 *
 * Le pilote répondait alors « Access denied for user », c'est-à-dire EXACTEMENT le message d'un
 * mot de passe faux. On cherche une faute de saisie, et il n'y en a pas : le mot de passe est
 * juste, c'est son transport qui le corrompt. Rien, dans le message, ne désigne l'encodage.
 */

describe('analyserUrlDeBase', () => {
  it('décode un mot de passe à ponctuation — le cas qui échouait', () => {
    /*
     * `p@ss/w%rd` réunit les trois caractères qui comptent : le `@` (qui sépare l'autorité), le `/`
     * (qui ouvre le chemin) et le `%` (qui amorce un échappement). Aucun ne peut figurer en clair
     * dans une URL, et chacun se décode différemment.
     */
    const identifiants = analyserUrlDeBase(
      'mysql://convention_user:p%40ss%2Fw%25rd@database:3306/convention_db'
    )

    expect(identifiants.password).toBe('p@ss/w%rd')
    expect(identifiants.user).toBe('convention_user')
    expect(identifiants.host).toBe('database')
    expect(identifiants.port).toBe(3306)
    expect(identifiants.database).toBe('convention_db')
  })

  it('laisse intact un mot de passe sans caractère spécial', () => {
    // La non-régression : la grande majorité des installations n'a rien à encoder, et le décodage
    // ne doit rien y changer.
    const identifiants = analyserUrlDeBase(
      'mysql://convention_user:changeme456@database:3306/convention_db'
    )

    expect(identifiants.password).toBe('changeme456')
  })

  it('décode aussi l’UTILISATEUR', () => {
    // Plus rare, mais un utilisateur nommé `app@prod` existe chez certains hébergeurs gérés.
    const identifiants = analyserUrlDeBase(
      'mysql://app%40prod:motdepasse@database:3306/convention_db'
    )

    expect(identifiants.user).toBe('app@prod')
  })

  it('décode aussi le NOM DE BASE', () => {
    // Un nom contenant un espace s'écrit encodé dans le chemin ; le pilote attend le nom réel.
    const identifiants = analyserUrlDeBase('mysql://u:p@database:3306/convention%20de%20jonglerie')

    expect(identifiants.database).toBe('convention de jonglerie')
  })

  it('retombe sur le port 3306 quand l’URL ne le précise pas', () => {
    /*
     * `new URL()` rend une chaîne VIDE pour un port absent, et `parseInt('')` vaut `NaN`. Sans
     * repli, le pilote recevrait `NaN` — et le message d'erreur parlerait de connexion refusée,
     * pas de port manquant.
     */
    const identifiants = analyserUrlDeBase('mysql://u:p@database/convention_db')

    expect(identifiants.port).toBe(3306)
  })

  it('ne LÈVE PAS sur un encodage invalide', () => {
    /*
     * `decodeURIComponent` lève sur un `%` isolé (`URIError: URI malformed`). C'est précisément le
     * cas d'un mot de passe contenant un `%` littéral que personne n'a encodé — et une exception au
     * démarrage y serait le pire résultat : l'application ne se lance pas, et la trace parle
     * d'« URI malformed » sans jamais nommer le mot de passe.
     *
     * On rend alors la valeur telle quelle : si elle est juste, la connexion passe ; si elle est
     * fausse, l'erreur d'authentification est la bonne erreur.
     */
    expect(() => analyserUrlDeBase('mysql://u:100%pur@database:3306/convention_db')).not.toThrow()

    const identifiants = analyserUrlDeBase('mysql://u:100%pur@database:3306/convention_db')
    expect(identifiants.password).toBe('100%pur')
  })

  it('l’encodage puis le décodage font l’aller-retour', () => {
    /*
     * ⚠️ L'INVARIANT DES DEUX MOITIÉS. L'entrypoint construit l'URL avec `encodeURIComponent` ;
     * cette fonction la relit. Si l'une des deux changeait de convention, la connexion échouerait
     * sur un « Access denied » aussi trompeur qu'avant. Ce test les tient ensemble.
     */
    const motsDePasse = ['p@ss/w%rd', 'aB3!#$&+=?', 'avec espace', 'unicode-éàü', ':::@@@///']

    for (const clair of motsDePasse) {
      const url = `mysql://${encodeURIComponent('u')}:${encodeURIComponent(clair)}@database:3306/db`
      expect(analyserUrlDeBase(url).password, `aller-retour sur « ${clair} »`).toBe(clair)
    }
  })
})
