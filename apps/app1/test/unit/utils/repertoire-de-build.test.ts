import { describe, expect, it } from 'vitest'

import {
  MOTIF_REPERTOIRE_DE_BUILD,
  repertoireDeBuild,
} from '../../../shared/utils/repertoire-de-build'

/**
 * ⚠️ CE QUE CES CAS GARDENT, et pourquoi ce n'est pas cosmétique.
 *
 * Le 2 octobre 2026, la production a servi sous `/_nuxt/KNI9fb3m.js` deux contenus différents :
 * celui de l'origine, et celui qu'un CDN avait gardé d'un build précédent. Rollup fige l'empreinte
 * qui NOMME un chunk avant d'y réécrire les noms de ses dépendances — le contenu change, le nom
 * non. Servi en `immutable, max-age=1 an`, le mauvais fichier est figé pour un an.
 *
 * Un répertoire par build supprime la collision. Encore faut-il que les DEUX lecteurs de chemins
 * suivent : l'en-tête de cache (`server/middleware/cache-headers.ts`) et le service worker
 * (`shared/utils/offline-cache.ts`). S'ils ne reconnaissent plus le répertoire, rien ne casse
 * visiblement — le site recharge simplement tout son bundle à chaque visite, et le hors-ligne
 * cesse de fonctionner.
 */
describe('repertoireDeBuild', () => {
  it('isole chaque build dans son propre répertoire', () => {
    expect(repertoireDeBuild('8098dfc2df58b6bad20299afec6f99bb37ee2c62')).toBe(
      '/_nuxt-8098dfc2df58/'
    )
    // Deux constructions différentes ne partagent plus aucune URL : c'est tout l'objet.
    expect(repertoireDeBuild('aaaaaaaaaaaa')).not.toBe(repertoireDeBuild('bbbbbbbbbbbb'))
  })

  it('retombe sur /_nuxt/ sans empreinte', () => {
    // Développement, construction locale, essai manuel : aucun CDN ne s'interpose.
    for (const vide of ['', '   ', undefined, null]) {
      expect(repertoireDeBuild(vide)).toBe('/_nuxt/')
    }
  })

  it('ne laisse pas une empreinte fantaisiste fabriquer un chemin', () => {
    /*
     * 🔬 La valeur devient un CHEMIN d'URL. Sans filtrage, une empreinte tordue produirait un
     * répertoire que ni l'en-tête de cache ni le service worker ne reconnaîtraient — en silence.
     */
    expect(repertoireDeBuild('../../etc')).toBe('/_nuxt-etc/')
    expect(repertoireDeBuild('a/b?c=1')).toBe('/_nuxt-abc1/')
    expect(repertoireDeBuild('!!!')).toBe('/_nuxt/')
  })

  it('produit toujours un répertoire que les deux lecteurs reconnaissent', () => {
    for (const empreinte of ['', '8098dfc2df58', 'ABC123', '../../etc']) {
      expect(MOTIF_REPERTOIRE_DE_BUILD.test(repertoireDeBuild(empreinte))).toBe(true)
    }
  })

  it('ne reconnaît pas un chemin qui ressemble sans en être un', () => {
    expect(MOTIF_REPERTOIRE_DE_BUILD.test('/_nuxtfoo/a.js')).toBe(false)
    expect(MOTIF_REPERTOIRE_DE_BUILD.test('/api/_nuxt_icon/x.json')).toBe(false)
    expect(MOTIF_REPERTOIRE_DE_BUILD.test('/public/_nuxt/a.js')).toBe(false)
  })
})
