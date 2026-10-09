import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { getTranslationsToLoad } from '../../../app/utils/translation-loaders'

/**
 * Une clé hors du domaine chargé par la route s'affiche BRUTE, sans erreur.
 *
 * ## ⚠️ Le défaut que ce test attrape, et pourquoi il était invisible
 *
 * Mesuré le 09/10/2026 sur `app/pages/profile/mes-conventions.vue` : **15 de ses clés `t()`**
 * appartiennent au domaine `edition` (`conventions.add_organizer`,
 * `conventions.cannot_load_conventions`…) et **10 au domaine `gestion`**
 * (`gestion.organizers.*`). Aucune règle ne chargeait l'un ni l'autre sur `/profile`, dont le
 * socle est `['auth', 'profil']`. L'écran affichait donc « conventions.add_organizer » à la place
 * du libellé.
 *
 * Deux raisons pour lesquelles personne ne l'avait vu, et chacune suffit :
 *
 * 1. **Le middleware CUMULE les domaines sur la session.** Qui passe par une page d'édition avant
 *    d'ouvrir « Mes conventions » voit les bons libellés. Le défaut n'apparaît qu'à l'ouverture
 *    DIRECTE — un favori, un rechargement, un premier clic depuis le menu du profil.
 * 2. **Le socle français n'est pas celui des autres langues.** `nuxt.config.ts` charge d'emblée
 *    `gestion.json` pour `fr` et pour `fr` SEULEMENT (7 fichiers contre 6). Les clés
 *    `gestion.*` marchaient donc en français et sortaient brutes dans les douze autres langues —
 *    invisible pour qui développe et teste en français.
 *
 * ## Ce que ce test NE fait pas
 *
 * Il ne balaie pas tout le dépôt. Le namespace d'un fichier vient de sa clé JSON racine et non de
 * son nom (`gestion` vit dans `gestion.json` comme dans `gestion-tasks.json`), beaucoup de clés
 * sont composées à l'exécution, et surtout **un composant hérite de la route qui le rend** : les
 * 22 fichiers employant `gestion.*` hors du dossier `gestion/` sont, à une exception près, des
 * composants rendus sur des routes `/gestion`. Un balayage naïf rendrait 222 faux positifs.
 *
 * Il couvre donc les **pages** dont on a vérifié qu'elles emploient des clés hors de leur socle.
 * Au 09/10/2026, le balayage des pages n'en trouve qu'une — celle ci-dessous.
 */

/**
 * Les domaines chargés d'emblée pour TOUTES les langues.
 *
 * ⚠️ C'est volontairement l'intersection, et non le socle français : viser le socle français
 * exempterait `gestion` et laisserait le défaut entier dans les douze autres langues.
 */
const SOCLE_COMMUN = ['app', 'common', 'components', 'feedback', 'notifications', 'public']

const PAGES = [
  {
    route: '/profile/mes-conventions',
    fichier: 'app/pages/profile/mes-conventions.vue',
    /** Racine de clé employée par la page → domaine qui la porte. */
    racines: { conventions: 'edition', gestion: 'gestion' },
  },
]

/** Les fichiers de locale chargés d'emblée, par langue, lus dans `nuxt.config.ts`. */
function soclesParLangue(): Record<string, string[]> {
  const config = fs.readFileSync(path.resolve(__dirname, '../../../nuxt.config.ts'), 'utf8')
  const socles: Record<string, string[]> = {}
  for (const bloc of config.matchAll(/code:\s*'(\w+)'[\s\S]{0,400}?files:\s*\[([\s\S]*?)\]/g)) {
    socles[bloc[1]!] = [...bloc[2]!.matchAll(/'[\w-]+\/([\w-]+)\.json'/g)].map((m) => m[1]!).sort()
  }
  return socles
}

describe('clés i18n — chaque page charge le domaine de ses clés', () => {
  it.each(PAGES)('$route charge les domaines de ses clés', ({ route, racines }) => {
    const charges = new Set([...SOCLE_COMMUN, ...getTranslationsToLoad(route)])

    for (const [racine, domaine] of Object.entries(racines)) {
      expect(charges.has(domaine), `« ${racine}.* » exige le domaine « ${domaine} »`).toBe(true)
    }
  })

  it.each(PAGES)('$route emploie bien les racines déclarées ici', ({ fichier, racines }) => {
    /*
     * La garde de la garde : sans elle, ce test resterait vert après un remaniement qui aurait
     * retiré ces clés de la page. On garderait un domaine chargé pour rien, et on croirait
     * couvrir un risque disparu.
     */
    const src = fs.readFileSync(path.resolve(__dirname, '../../../', fichier), 'utf8')
    const employees = new Set([...src.matchAll(/\$?t\('([a-z][\w]*)\./g)].map((m) => m[1]!))

    for (const racine of Object.keys(racines)) {
      expect(employees.has(racine), `${fichier} n'emploie plus « ${racine}.* »`).toBe(true)
    }
  })

  it('le socle commun correspond à ce que nuxt.config.ts charge pour toutes les langues', () => {
    // On lit la configuration plutôt que de la recopier de mémoire : un socle qui change sans
    // que ce test change le rendrait faux dans les deux sens.
    const socles = soclesParLangue()
    expect(Object.keys(socles).length).toBeGreaterThanOrEqual(13)

    const communs = Object.values(socles).reduce<string[]>(
      (acc, fichiers) => acc.filter((f) => fichiers.includes(f)),
      Object.values(socles)[0]!
    )
    expect(communs.sort()).toEqual([...SOCLE_COMMUN].sort())
  })

  it('⚠️ le socle français porte `gestion` en plus — anomalie connue, à ne pas laisser grandir', () => {
    /*
     * Ce test ENREGISTRE un défaut au lieu de l'exiger corrigé, et c'est délibéré : retirer
     * `gestion` du socle français change le chargement de toute l'application et mérite son
     * propre lot. Ce qu'il empêche, c'est que l'écart grandisse ou soit oublié — et il tombera
     * le jour où on le corrigera, ce qui est exactement le rappel voulu.
     */
    const socles = soclesParLangue()
    const { fr, ...autres } = socles

    expect(fr).toEqual([...SOCLE_COMMUN, 'gestion'].sort())
    for (const [langue, fichiers] of Object.entries(autres)) {
      expect(fichiers, `${langue} ne devrait pas avoir d'extra`).toEqual([...SOCLE_COMMUN].sort())
    }
  })
})
