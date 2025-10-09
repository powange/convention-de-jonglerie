import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/objets-trouves', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/editions/1/objets-trouves')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger la page objets-trouves', () => {
    expect(page.html()).toMatch(/objets|trouvés|lost|found|item/i)
  })
})
