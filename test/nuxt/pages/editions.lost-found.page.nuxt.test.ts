import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/lost-found', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/editions/1/lost-found')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger la page lost-found', () => {
    expect(page.html()).toMatch(/objets|trouvés|lost|found|item/i)
  })
})
