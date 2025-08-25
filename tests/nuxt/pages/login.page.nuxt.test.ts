import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page login: rendu des 3 étapes basiques (on ne navigue pas encore entre elles ici)

describe('Page /login', () => {
  it('devrait afficher le titre de connexion', async () => {
    const page = await renderRawPage('/login')
    expect(page.html()).toMatch(/login|email|password|auth/i)
    page.unmount?.()
  })
})
