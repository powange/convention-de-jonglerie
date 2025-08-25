import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page favoris (sans authentification simulée pour l'instant)

describe('Page /favorites', () => {
  it('rend la page (peut rediriger si auth requise)', async () => {
  const page = await renderRawPage('/favorites')
  expect(page.html()).toMatch(/favorite|login|auth|Edition/i)
  page.unmount?.()
  })
})
