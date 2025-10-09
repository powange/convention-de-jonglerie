import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /conventions/add', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/conventions/add')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger le formulaire ajout convention', () => {
    expect(page.html()).toMatch(/convention|ajout|adresse|address|nom|name/i)
  })
})
