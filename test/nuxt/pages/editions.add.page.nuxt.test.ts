import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/add', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/editions/add')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger le formulaire ajout édition', () => {
    expect(page.html()).toMatch(/edition|ajout|date|nom|name/i)
  })
})
