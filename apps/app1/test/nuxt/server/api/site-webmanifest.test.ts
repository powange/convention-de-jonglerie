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
})
