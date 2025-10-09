import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page login: rendu des 3 étapes basiques (on ne navigue pas encore entre elles ici)

describe('Page /login', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/login')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('devrait afficher le titre de connexion', () => {
    expect(page.html()).toMatch(/login|email|password|auth/i)
  })
})
