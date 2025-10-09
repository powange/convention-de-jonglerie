import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page register

describe('Page /register', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/register')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('devrait se rendre et contenir indices de formulaire', () => {
    expect(page.html()).toMatch(/register|email|pseudo|auth/i)
  })
})
