import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page d'accueil: vérifie le rendu basique et quelques éléments clés de filtres

describe('Page / (Accueil)', () => {
  it('devrait se rendre et afficher le titre des filtres', async () => {
    const page = await renderRawPage('/')
    expect(page.html()).toMatch(/filters|homepage|convention/i)
    page.unmount?.()
  })
})
