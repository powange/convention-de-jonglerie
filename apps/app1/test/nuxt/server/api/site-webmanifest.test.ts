import { describe, it, expect } from 'vitest'

import handler from '../../../../server/api/site.webmanifest.get'

/**
 * Le manifeste déclarait `orientation: 'portrait-primary'`, ce qui empêchait de tourner le
 * téléphone une fois l'application installée — alors que le planning des bénévoles, les tableaux
 * de gestion ou la carte du site gagnent à être vus en paysage.
 *
 * Le test refuse toute valeur qui verrouille, et pas seulement celle d'origine : « landscape »
 * poserait exactement le même problème dans l'autre sens.
 */
describe('Manifeste de l’application', () => {
  const VERROUS = [
    'portrait',
    'portrait-primary',
    'portrait-secondary',
    'landscape',
    'landscape-primary',
    'landscape-secondary',
  ]

  it('ne verrouille pas l’orientation de l’écran', async () => {
    const manifeste: any = await (handler as any)({} as any)

    expect(manifeste.orientation).toBeDefined()
    expect(
      VERROUS,
      `orientation « ${manifeste.orientation} » : l’écran ne pourrait plus tourner`
    ).not.toContain(manifeste.orientation)
  })

  /**
   * L'icône adaptative d'Android, et pourquoi elle se teste.
   *
   * ⚠️ Android ne dessine pas l'icône telle quelle : il la MASQUE selon la forme choisie par le
   * constructeur — cercle, carré arrondi, goutte. Seul le disque central de 80 % du côté est
   * garanti visible.
   *
   * Sans aucune icône `maskable`, Android se rabat sur l'icône ordinaire en la posant sur une
   * pastille blanche : c'est l'effet « logo rétréci dans un rond blanc » de beaucoup
   * d'applications web. Et coller `maskable` sur une icône qui occupe tout son carré — ce que font
   * les trois autres — amputerait le logo de ses coins.
   *
   * Rien de tout cela ne se voit ailleurs que sur un téléphone : d'où ces tests.
   */
  describe('icône adaptative Android', () => {
    it('déclare EXACTEMENT une icône maskable', async () => {
      const manifeste: any = await (handler as any)({} as any)
      const maskables = manifeste.icons.filter((icone: any) => icone.purpose === 'maskable')

      expect(maskables).toHaveLength(1)
      expect(maskables[0].sizes).toBe('512x512')
    })

    it('n’emploie PAS le même fichier que l’icône ordinaire', async () => {
      /*
       * 🔬 L'assertion qui porte tout. Déclarer `maskable` sur l'icône existante passerait les
       * autres tests et produirait exactement le défaut qu'on veut éviter : le logo, qui occupe
       * son carré bord à bord, serait rogné. La variante maskable est un fichier SÉPARÉ, où le
       * même logo est réduit pour tenir dans le disque de sécurité.
       */
      const manifeste: any = await (handler as any)({} as any)
      const maskable = manifeste.icons.find((icone: any) => icone.purpose === 'maskable')
      const ordinaires = manifeste.icons.filter((icone: any) => icone.purpose !== 'maskable')

      expect(maskable.src).toContain('maskable')
      for (const icone of ordinaires) {
        expect(icone.src).not.toBe(maskable.src)
      }
    })

    it('donne un `purpose` à CHAQUE icône', async () => {
      /*
       * Une icône sans `purpose` vaut `any` par défaut, donc le rendu serait correct. Mais une
       * icône ajoutée plus tard sans y penser est précisément la façon dont une icône maskable
       * fautive entre dans le manifeste. L'exiger partout rend l'omission visible à l'écriture.
       */
      const manifeste: any = await (handler as any)({} as any)

      for (const icone of manifeste.icons) {
        expect(icone.purpose, `icône ${icone.src} sans purpose`).toBeDefined()
      }
    })
  })
})
