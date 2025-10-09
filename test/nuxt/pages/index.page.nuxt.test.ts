import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page d'accueil: vérifie le rendu basique et quelques éléments clés de filtres

describe('Page / (Accueil)', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('devrait se rendre et afficher le titre des filtres', () => {
    expect(page.html()).toMatch(/filters|homepage|convention/i)
  })
})
